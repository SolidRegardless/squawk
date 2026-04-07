import { create } from 'zustand';
import { relay } from '../services/relay.js';
import { db } from '../services/db.js';
import { notificationService } from '../services/notifications.js';
import type { ChatMessage } from '../../../shared/src/messages.js';

const MAX_HISTORY = 200;

interface ChatState {
  conversations: Record<string, ChatMessage[]>;
  activeChat: string | null;
  setActiveChat: (jid: string | null) => void;
  sendMessage: (to: string, body: string) => void;
  init: () => () => void;
  getUnread: (jid: string) => number;
  unreadCounts: Record<string, number>;
  clearHistory: (jid: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  activeChat: null,
  unreadCounts: {},

  setActiveChat: (jid) => {
    set({ activeChat: jid });
    if (jid) {
      const counts = { ...get().unreadCounts };
      delete counts[jid];
      set({ unreadCounts: counts });
    }
  },

  sendMessage: (to, body) => {
    relay.send({ type: 'message:send', to, body });
  },

  getUnread: (jid) => get().unreadCounts[jid] || 0,

  clearHistory: async (jid) => {
    await db.messages.where('chatJid').equals(jid).delete();
    const convos = { ...get().conversations };
    delete convos[jid];
    set({ conversations: convos });
  },

  init: () => {
    // Load persisted DM messages from DB
    db.messages
      .where('type')
      .equals('dm')
      .sortBy('timestamp')
      .then((rows) => {
        const convos: Record<string, ChatMessage[]> = {};
        for (const row of rows) {
          const msgs = convos[row.chatJid] || [];
          msgs.push({
            id: row.id,
            from: row.from,
            to: row.to,
            body: row.body,
            timestamp: row.timestamp,
            mine: row.mine,
            nick: row.nick,
          });
          convos[row.chatJid] = msgs;
        }
        set({ conversations: convos });
      });

    return relay.onMessage((msg) => {
      if (msg.type === 'message') {
        const m = msg.message;
        const chatJid = m.mine ? m.to : m.from;
        const convos = { ...get().conversations };
        const existing = convos[chatJid] || [];
        if (!existing.some((e) => e.id === m.id)) {
          const updated = [...existing, m];
          convos[chatJid] = updated;
          set({ conversations: convos });

          // Persist to DB
          db.messages.put({
            id: m.id,
            from: m.from,
            to: m.to,
            body: m.body,
            timestamp: m.timestamp,
            chatJid,
            type: 'dm',
            mine: m.mine,
            nick: m.nick,
          });

          // Cap to MAX_HISTORY
          if (updated.length > MAX_HISTORY) {
            const toDelete = updated.slice(0, updated.length - MAX_HISTORY);
            db.messages.bulkDelete(toDelete.map((x) => x.id));
            convos[chatJid] = updated.slice(-MAX_HISTORY);
            set({ conversations: convos });
          }

          // Increment unread + notify if not active
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
