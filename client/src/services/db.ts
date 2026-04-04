import Dexie, { type EntityTable } from 'dexie';
import type { AccountConfig } from '../../../shared/src/account.js';

const db = new Dexie('squawk') as Dexie & {
  accounts: EntityTable<AccountConfig, 'id'>;
};

db.version(1).stores({
  accounts: 'id, domain, lastUsedAt',
});

export { db };
