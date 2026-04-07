import { create } from 'zustand';
import { relay } from '../services/relay.js';
import type { ChatMessage } from '../../../shared/src/messages.js';

interface ChatState {
  conversations: Record<string, ChatMessage[]>;
  activeChat: string | null;
  unreadCounts: Record<string, number>;
  deliveredIds: Record<string, boolean>;
  setActiveChat: (jid: string | null) => void;
  sendMessage: (to: string, body: string) => void;
  init: () => () => void;
  getUnread: (jid: string) => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  activeChat: null,
  unreadCounts: {},
  deliveredIds: {},

  setActiveChat: (jid) => {
    set({ activeChat: jid });
    if (jid) {
      // Clear unread
      const counts = { ...get().unreadCounts };
      delete counts[jid];
      set({ unreadCounts: counts });
    }
  },

  sendMessage: (to, body) => {
    relay.send({ type: 'message:send', to, body });
  },

  getUnread: (jid) => get().unreadCounts[jid] || 0,

  init: () => {
    return relay.onMessage((msg) => {
      if (msg.type === 'message') {
        const m = msg.message;
        const chatJid = m.mine ? m.to : m.from;
        const convos = { ...get().conversations };
        const existing = convos[chatJid] || [];
        // Avoid duplicates
        if (!existing.some((e) => e.id === m.id)) {
          convos[chatJid] = [...existing, m];
          set({ conversations: convos });

          // Increment unread if not active
          if (chatJid !== get().activeChat && !m.mine) {
            const counts = { ...get().unreadCounts };
            counts[chatJid] = (counts[chatJid] || 0) + 1;
            set({ unreadCounts: counts });
          }
        }
      } else if (msg.type === 'receipt') {
        const { id } = msg;
        set({ deliveredIds: { ...get().deliveredIds, [id]: true } });
        // Update status on the matching message
        const convos = { ...get().conversations };
        for (const jid of Object.keys(convos)) {
          const msgs = convos[jid];
          if (msgs.some((m) => m.id === id)) {
            convos[jid] = msgs.map((m) =>
              m.id === id ? { ...m, status: 'delivered' as const } : m
            );
            set({ conversations: convos });
            break;
          }
        }
      }
    });
  },
}));
