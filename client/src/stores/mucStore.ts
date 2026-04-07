import { create } from 'zustand';
import { relay } from '../services/relay.js';
import type { ChatMessage, RoomInfo, RoomDetail } from '../../../shared/src/messages.js';

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

  init: (domain) => {
    set({ conferenceServer: `conference.${domain}` });

    return relay.onMessage((msg) => {
      switch (msg.type) {
        case 'error':
          set({ error: msg.message });
          // Auto-clear after 5 seconds
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
          break;
        }
        case 'muc:message': {
          const msgs = { ...get().messages };
          const existing = msgs[msg.room] || [];
          if (!existing.some((e) => e.id === msg.message.id)) {
            msgs[msg.room] = [...existing, msg.message];
            set({ messages: msgs });

            // Unread
            if (msg.room !== get().activeRoom && !msg.message.mine) {
              const rooms = { ...get().joinedRooms };
              if (rooms[msg.room]) {
                rooms[msg.room] = { ...rooms[msg.room], unread: (rooms[msg.room].unread || 0) + 1 };
                set({ joinedRooms: rooms });
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
