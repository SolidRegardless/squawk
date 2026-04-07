import Dexie, { type EntityTable } from 'dexie';
import type { AccountConfig } from '../../../shared/src/account.js';

export interface PersistedMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  chatJid: string;
  type: 'dm' | 'muc';
  mine?: boolean;
  nick?: string;
}

export interface PersistedRoom {
  jid: string;
  name: string;
  subject?: string;
}

const db = new Dexie('squawk') as Dexie & {
  accounts: EntityTable<AccountConfig, 'id'>;
  messages: EntityTable<PersistedMessage, 'id'>;
  rooms: EntityTable<PersistedRoom, 'jid'>;
};

db.version(1).stores({
  accounts: 'id, domain, lastUsedAt',
});

db.version(2).stores({
  accounts: 'id, domain, lastUsedAt',
  messages: 'id, chatJid, type, timestamp',
});

db.version(3).stores({
  accounts: 'id, domain, lastUsedAt',
  messages: 'id, chatJid, type, timestamp',
  rooms: 'jid',
});

export { db };
