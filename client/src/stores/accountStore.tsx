import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db } from '../services/db.js';
import { relay } from '../services/relay.js';
import type { AccountConfig, AccountCreateInput, AccountStatus } from '../../../shared/src/account.js';

interface AccountState {
  accounts: AccountConfig[];
  activeAccountId: string | null;
  connectionStatus: AccountStatus['state'];
  connectionError: string | null;

  // Actions
  loadAccounts: () => Promise<void>;
  createAccount: (input: AccountCreateInput & { password: string }) => Promise<AccountConfig>;
  updateAccount: (id: string, updates: Partial<AccountConfig>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  connect: (password?: string) => void;
  disconnect: () => void;
  setStatus: (status: AccountStatus['state'], error?: string) => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  connectionStatus: 'disconnected',
  connectionError: null,

  loadAccounts: async () => {
    const accounts = await db.accounts.orderBy('lastUsedAt').reverse().toArray();
    const activeId = accounts.length > 0 ? accounts[0].id : null;
    set({ accounts, activeAccountId: activeId });

    // Set up relay message handling
    relay.onMessage((msg) => {
      switch (msg.type) {
        case 'status':
          set({
            connectionStatus: msg.status.state,
            connectionError: msg.status.error ?? null,
          });
          break;
        case 'connected':
          set({ connectionStatus: 'connected', connectionError: null });
          break;
        case 'error':
          set({
            connectionStatus: 'error',
            connectionError: msg.details ?? msg.message,
          });
          break;
      }
    });

    relay.connect();
  },

  createAccount: async (input) => {
    const account: AccountConfig = {
      id: uuid(),
      protocol: 'xmpp',
      username: input.username,
      domain: input.domain,
      resource: input.resource || undefined,
      savePassword: input.savePassword,
      password: input.savePassword ? input.password : undefined,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    await db.accounts.add(account);
    const accounts = [...get().accounts, account];
    set({ accounts, activeAccountId: account.id });

    // Sync to relay
    relay.send({ type: 'account:sync', accounts });

    return account;
  },

  updateAccount: async (id, updates) => {
    await db.accounts.update(id, updates);
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
    set({ accounts });
    relay.send({ type: 'account:sync', accounts });
  },

  deleteAccount: async (id) => {
    await db.accounts.delete(id);
    const accounts = get().accounts.filter((a) => a.id !== id);
    const activeId = get().activeAccountId === id
      ? accounts[0]?.id ?? null
      : get().activeAccountId;
    set({ accounts, activeAccountId: activeId });
    relay.send({ type: 'account:sync', accounts });
  },

  setActive: (id) => {
    set({ activeAccountId: id });
    db.accounts.update(id, { lastUsedAt: new Date().toISOString() });
  },

  connect: (password?: string) => {
    const { activeAccountId } = get();
    if (!activeAccountId) return;
    set({ connectionStatus: 'connecting', connectionError: null });

    // Sync accounts first, then connect
    relay.send({ type: 'account:sync', accounts: get().accounts });
    relay.send({ type: 'connect', accountId: activeAccountId, password });
  },

  disconnect: () => {
    const { activeAccountId } = get();
    if (!activeAccountId) return;
    relay.send({ type: 'disconnect', accountId: activeAccountId });
    set({ connectionStatus: 'disconnected', connectionError: null });
  },

  setStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },
}));
