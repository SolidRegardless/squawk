import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db } from '../services/db.js';
import { relay } from '../services/relay.js';
import type { AccountConfig, AccountCreateInput, AccountStatus } from '../../../shared/src/account.js';

export type ConnectionStep = 'relay' | 'resolve' | 'handshake' | 'auth' | 'roster';
export type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface AccountState {
  accounts: AccountConfig[];
  activeAccountId: string | null;
  connectionStatus: AccountStatus['state'];
  connectionError: string | null;
  connectionSteps: Record<ConnectionStep, StepStatus>;

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

const initialSteps: Record<ConnectionStep, StepStatus> = {
  relay: 'pending',
  resolve: 'pending',
  handshake: 'pending',
  auth: 'pending',
  roster: 'pending',
};

export const useAccountStore = create<AccountState>((set, get) => {
  let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  let relayCheckInterval: ReturnType<typeof setInterval> | null = null;

  const clearTimers = () => {
    if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
    if (relayCheckInterval) { clearInterval(relayCheckInterval); relayCheckInterval = null; }
  };

  return {
    accounts: [],
    activeAccountId: null,
    connectionStatus: 'disconnected',
    connectionError: null,
    connectionSteps: { ...initialSteps },

    loadAccounts: async () => {
      const accounts = await db.accounts.orderBy('lastUsedAt').reverse().toArray();
      const activeId = accounts.length > 0 ? accounts[0].id : null;
      set({ accounts, activeAccountId: activeId });

      // Set up relay message handling
      relay.onMessage((msg) => {
        switch (msg.type) {
          case 'step': {
            // Granular step updates from the relay
            const steps = { ...get().connectionSteps };
            steps[msg.step as ConnectionStep] = msg.status as StepStatus;
            set({ connectionSteps: steps });
            break;
          }
          case 'status':
            if (msg.status.state === 'connecting') {
              set({ connectionStatus: 'connecting' });
            } else if (msg.status.state === 'connected') {
              set({
                connectionStatus: 'connected',
                connectionError: null,
              });
              clearTimers();
            } else if (msg.status.state === 'error') {
              set({
                connectionStatus: 'error',
                connectionError: msg.status.error ?? 'Unknown error',
              });
              clearTimers();
            }
            break;
          case 'connected':
            set({
              connectionStatus: 'connected',
              connectionError: null,
            });
            clearTimers();
            break;
          case 'error': {
            set({
              connectionStatus: 'error',
              connectionError: msg.details ?? msg.message,
            });
            clearTimers();
            break;
          }
        }
      });
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
        transport: input.transport || 'tcp',
        port: input.port,
        security: input.security || 'require-tls',
        connectServer: input.connectServer,
        boshUrl: input.boshUrl,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await db.accounts.add(account);
      const accounts = [...get().accounts, account];
      set({ accounts, activeAccountId: account.id });

      return account;
    },

    updateAccount: async (id, updates) => {
      await db.accounts.update(id, updates);
      const accounts = get().accounts.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      );
      set({ accounts });
    },

    deleteAccount: async (id) => {
      await db.accounts.delete(id);
      const accounts = get().accounts.filter((a) => a.id !== id);
      const activeId = get().activeAccountId === id
        ? accounts[0]?.id ?? null
        : get().activeAccountId;
      set({ accounts, activeAccountId: activeId });
    },

    setActive: (id) => {
      set({ activeAccountId: id });
      db.accounts.update(id, { lastUsedAt: new Date().toISOString() });
    },

    connect: (password?: string) => {
      const { activeAccountId, accounts } = get();
      if (!activeAccountId) return;

      clearTimers();

      // Reset steps
      set({
        connectionStatus: 'connecting',
        connectionError: null,
        connectionSteps: {
          relay: 'active',
          resolve: 'pending',
          handshake: 'pending',
          auth: 'pending',
          roster: 'pending',
        },
      });

      // Start relay connection
      relay.connect();

      // Check relay is connected, then send
      let attempts = 0;
      relayCheckInterval = setInterval(() => {
        attempts++;
        if (relay.isConnected()) {
          clearInterval(relayCheckInterval!);
          relayCheckInterval = null;

          set({
            connectionSteps: {
              relay: 'done',
              resolve: 'active',
              handshake: 'pending',
              auth: 'pending',
              roster: 'pending',
            },
          });

          // Sync accounts then connect
          relay.send({ type: 'account:sync', accounts });
          relay.send({ type: 'connect', accountId: activeAccountId, password });
        } else if (attempts >= 10) {
          // 5 seconds, relay not available
          clearInterval(relayCheckInterval!);
          relayCheckInterval = null;
          set({
            connectionStatus: 'error',
            connectionError: 'Could not connect to the Squawk relay server. Make sure it\'s running on port 3001.\n\nStart it with: cd relay && npm run dev',
            connectionSteps: {
              relay: 'error',
              resolve: 'pending',
              handshake: 'pending',
              auth: 'pending',
              roster: 'pending',
            },
          });
        }
      }, 500);

      // Overall timeout — 15 seconds
      connectionTimeout = setTimeout(() => {
        const { connectionStatus } = get();
        if (connectionStatus === 'connecting') {
          clearTimers();
          set({
            connectionStatus: 'error',
            connectionError: 'Connection timed out after 15 seconds. The XMPP server may be unreachable.',
            connectionSteps: {
              ...get().connectionSteps,
              // Mark current active step as error
              ...Object.fromEntries(
                Object.entries(get().connectionSteps).map(([k, v]) =>
                  [k, v === 'active' ? 'error' : v]
                )
              ) as Record<ConnectionStep, StepStatus>,
            },
          });
        }
      }, 15000);
    },

    disconnect: () => {
      clearTimers();
      const { activeAccountId } = get();
      if (activeAccountId) {
        relay.send({ type: 'disconnect', accountId: activeAccountId });
      }
      set({
        connectionStatus: 'disconnected',
        connectionError: null,
        connectionSteps: { ...initialSteps },
      });
    },

    setStatus: (status, error) => {
      set({ connectionStatus: status, connectionError: error ?? null });
    },
  };
});
