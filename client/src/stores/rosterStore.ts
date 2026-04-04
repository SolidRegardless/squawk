import { create } from 'zustand';
import { relay } from '../services/relay.js';
import type { Contact, PresenceInfo } from '../../../shared/src/messages.js';

interface RosterState {
  contacts: Contact[];
  init: () => () => void;
  requestRoster: () => void;
}

export const useRosterStore = create<RosterState>((set, get) => ({
  contacts: [],

  init: () => {
    return relay.onMessage((msg) => {
      switch (msg.type) {
        case 'roster':
          set({ contacts: msg.contacts });
          break;
        case 'presence': {
          const contacts = get().contacts.map((c) =>
            c.jid === msg.jid ? { ...c, presence: msg.presence } : c,
          );
          set({ contacts });
          break;
        }
      }
    });
  },

  requestRoster: () => {
    relay.send({ type: 'roster:get' });
  },
}));
