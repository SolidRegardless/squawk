import { create } from 'zustand';
import { relay } from '../services/relay.js';
import { notificationService } from '../services/notifications.js';
import type { ChatMessage } from '../../../shared/src/messages.js';

interface ChatState {
  conversations: Record<string, ChatMessage[]>;
  activeChat: string | null;
  setActiveChat: (jid: string | null) => void;
  sendMessage: (to: string, body: string) => void;
  init: () => () => void;
  getUnread: (jid: string) => number;
  unreadCounts: Record<string, number>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  activeChat: null,
  unreadCounts: {},

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
            notificationService.notify(m.from.split('@')[0], m.body, { tag: chatJid });
          }
        }
      }
    });
  },
}));
