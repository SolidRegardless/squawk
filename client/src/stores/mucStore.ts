import { create } from 'zustand';
import { relay } from '../services/relay.js';
import { db } from '../services/db.js';
import { notificationService } from '../services/notifications.js';
import type { ChatMessage, RoomInfo, RoomDetail } from '../../../shared/src/messages.js';

const MAX_HISTORY = 200;

export interface JoinedRoom {
  jid: string;
  name: string;
  subject?: string;
  participants: string[];
  unread: number;
}

interface MucState {
  joinedRooms: Record<string, JoinedRoom>;
  messages: Record<string, ChatMessage[]>;
  availableRooms: RoomInfo[];
  activeRoom: string | null;
  conferenceServer: string;
  loading: boolean;
  error: string | null;

  setActiveRoom: (jid: string | null) => void;
  setConferenceServer: (server: string) => void;
  listRooms: (server: string) => void;
  joinRoom: (roomJid: string, nick: string) => void;
  leaveRoom: (roomJid: string) => void;
  sendMessage: (roomJid: string, body: string) => void;
  clearError: () => void;
  clearHistory: (jid: string) => Promise<void>;
  init: (domain: string) => () => void;
}

export const useMucStore = create<MucState>((set, get) => ({
  joinedRooms: {},
  messages: {},
  availableRooms: [],
  activeRoom: null,
  conferenceServer: '',
  loading: false,
  error: null,

  setActiveRoom: (jid) => {
    set({ activeRoom: jid });
    if (jid) {
      const rooms = { ...get().joinedRooms };
      if (rooms[jid]) {
        rooms[jid] = { ...rooms[jid], unread: 0 };
        set({ joinedRooms: rooms });
      }
      // Fetch history if sparse
      const msgs = get().messages[jid] || [];
      if (msgs.length < 10) {
        relay.send({ type: 'history:fetch', jid, isRoom: true });
      }
    }
  },

  setConferenceServer: (server) => set({ conferenceServer: server }),

  listRooms: (server) => {
    set({ loading: true });
    relay.send({ type: 'muc:list', server });
  },

  joinRoom: (roomJid, nick) => {
    relay.send({ type: 'muc:join', room: roomJid, nick });
  },

  leaveRoom: (roomJid) => {
    relay.send({ type: 'muc:leave', room: roomJid });
    db.rooms.delete(roomJid);
    const rooms = { ...get().joinedRooms };
    delete rooms[roomJid];
    const msgs = { ...get().messages };
    delete msgs[roomJid];
    set({ joinedRooms: rooms, messages: msgs });
    if (get().activeRoom === roomJid) set({ activeRoom: null });
  },

  sendMessage: (roomJid, body) => {
    relay.send({ type: 'muc:send', room: roomJid, body });
  },

  clearError: () => set({ error: null }),

  clearHistory: async (jid) => {
    await db.messages.where('chatJid').equals(jid).delete();
    const msgs = { ...get().messages };
    delete msgs[jid];
    set({ messages: msgs });
  },

  init: (domain) => {
    set({ conferenceServer: `conference.${domain}` });

    // Load persisted rooms from DB into joinedRooms
    db.rooms.toArray().then((rows) => {
      const persisted: Record<string, JoinedRoom> = {};
      for (const row of rows) {
        persisted[row.jid] = {
          jid: row.jid,
          name: row.name,
          subject: row.subject,
          participants: [],
          unread: 0,
        };
      }
      // Merge: persisted provides the base, any already-in-memory rooms win
      set({ joinedRooms: { ...persisted, ...get().joinedRooms } });
    });

    // Load persisted MUC messages from DB
    db.messages
      .where('type')
      .equals('muc')
      .sortBy('timestamp')
      .then((rows) => {
        const allMsgs: Record<string, ChatMessage[]> = {};
        for (const row of rows) {
          const msgs = allMsgs[row.chatJid] || [];
          msgs.push({
            id: row.id,
            from: row.from,
            to: row.to,
            body: row.body,
            timestamp: row.timestamp,
            mine: row.mine,
            nick: row.nick,
          });
          allMsgs[row.chatJid] = msgs;
        }
        const current = get().messages;
        const merged: Record<string, ChatMessage[]> = { ...allMsgs };
        for (const [jid, msgs] of Object.entries(current)) {
          if (!merged[jid]) merged[jid] = msgs;
        }
        set({ messages: merged });
      });

    return relay.onMessage((msg) => {
      switch (msg.type) {
        case 'error':
          set({ error: msg.message });
          setTimeout(() => set({ error: null }), 5000);
          break;
        case 'muc:rooms':
          set({ availableRooms: msg.rooms, loading: false });
          break;
        case 'muc:joined': {
          const rooms = { ...get().joinedRooms };
          const existing = rooms[msg.room.jid];
          rooms[msg.room.jid] = {
            ...msg.room,
            participants: [...new Set([...(existing?.participants || []), ...msg.room.participants])],
            unread: existing?.unread || 0,
          };
          set({ joinedRooms: rooms });
          // Persist room so it survives browser close
          db.rooms.put({ jid: msg.room.jid, name: msg.room.name, subject: msg.room.subject });
          break;
        }
        case 'muc:message': {
          const msgs = { ...get().messages };
          const existing = msgs[msg.room] || [];
          if (!existing.some((e) => e.id === msg.message.id)) {
            const updated = [...existing, msg.message];
            msgs[msg.room] = updated;
            set({ messages: msgs });

            // Persist to DB
            db.messages.put({
              id: msg.message.id,
              from: msg.message.from,
              to: msg.message.to,
              body: msg.message.body,
              timestamp: msg.message.timestamp,
              chatJid: msg.room,
              type: 'muc',
              mine: msg.message.mine,
              nick: msg.message.nick,
            });

            // Cap to MAX_HISTORY
            if (updated.length > MAX_HISTORY) {
              const toDelete = updated.slice(0, updated.length - MAX_HISTORY);
              db.messages.bulkDelete(toDelete.map((x) => x.id));
              msgs[msg.room] = updated.slice(-MAX_HISTORY);
              set({ messages: msgs });
            }

            // Unread + notify if not active
            if (msg.room !== get().activeRoom && !msg.message.mine) {
              const rooms = { ...get().joinedRooms };
              if (rooms[msg.room]) {
                rooms[msg.room] = { ...rooms[msg.room], unread: (rooms[msg.room].unread || 0) + 1 };
                set({ joinedRooms: rooms });
                const roomName = rooms[msg.room].name || msg.room;
                const sender = msg.message.nick || msg.message.from.split('@')[0];
                notificationService.notify(roomName, `${sender}: ${msg.message.body}`, { tag: msg.room });
              }
            }
          }
          break;
        }
        case 'muc:presence': {
          const rooms = { ...get().joinedRooms };
          const room = rooms[msg.room];
          if (room) {
            const participants = [...room.participants];
            if (msg.action === 'join' && !participants.includes(msg.nick)) {
              participants.push(msg.nick);
            } else if (msg.action === 'leave') {
              const idx = participants.indexOf(msg.nick);
              if (idx !== -1) participants.splice(idx, 1);
            }
            rooms[msg.room] = { ...room, participants };
            set({ joinedRooms: rooms });
          }
          break;
        }
      }
    });
  },
}));
