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

const db = new Dexie('squawk') as Dexie & {
  accounts: EntityTable<AccountConfig, 'id'>;
  messages: EntityTable<PersistedMessage, 'id'>;
};

db.version(1).stores({
  accounts: 'id, domain, lastUsedAt',
});

db.version(2).stores({
  accounts: 'id, domain, lastUsedAt',
  messages: 'id, chatJid, type, timestamp',
});

export { db };
