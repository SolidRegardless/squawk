// @ts-nocheck — @xmpp/client has limited TS types
import { client, xml, jid } from '@xmpp/client';
import type { AccountConfig, AccountStatus } from '../../../shared/src/account.js';
import type { RelayMessage } from '../../../shared/src/messages.js';

type EventCallback = (msg: RelayMessage) => void;

interface ManagedConnection {
  xmpp: any;
  accountId: string;
  status: AccountStatus;
}

export class XmppManager {
  private connections = new Map<string, ManagedConnection>();
  private accounts = new Map<string, AccountConfig>();
  private listeners = new Set<EventCallback>();

  onEvent(cb: EventCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(msg: RelayMessage) {
    for (const cb of this.listeners) {
      try { cb(msg); } catch { /* swallow */ }
    }
  }

  private emitStatus(accountId: string, state: AccountStatus['state'], error?: string, jidStr?: string) {
    const status: AccountStatus = { accountId, state, error, jid: jidStr };
    this.emit({ type: 'status', status });

    const conn = this.connections.get(accountId);
    if (conn) conn.status = status;
  }

  syncAccounts(accounts: AccountConfig[]) {
    this.accounts.clear();
    for (const acc of accounts) {
      this.accounts.set(acc.id, acc);
    }
    console.log(`[xmpp] Synced ${accounts.length} account(s)`);
  }

  async connect(accountId: string, passwordOverride?: string) {
    // Disconnect existing if any
    await this.disconnect(accountId);

    const account = this.accounts.get(accountId);
    if (!account) {
      this.emit({
        type: 'error',
        accountId,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found. Sync accounts first.',
      });
      return;
    }

    const password = passwordOverride || account.password;
    if (!password) {
      this.emit({
        type: 'error',
        accountId,
        code: 'NO_PASSWORD',
        message: 'Password required — not saved on account.',
      });
      return;
    }

    const resource = account.resource || `squawk-${Date.now().toString(36)}`;
    const fullJid = `${account.username}@${account.domain}/${resource}`;
    const server = account.connectServer || account.domain;
    const port = account.port || 5222;

    this.emitStatus(accountId, 'connecting');
    console.log(`[xmpp] Connecting ${fullJid} → ${server}:${port}`);

    try {
      const xmpp = client({
        service: `xmpp://${server}:${port}`,
        domain: account.domain,
        resource,
        username: account.username,
        password,
      });

      const managed: ManagedConnection = {
        xmpp,
        accountId,
        status: { accountId, state: 'connecting' },
      };
      this.connections.set(accountId, managed);

      xmpp.on('status', (status: string) => {
        console.log(`[xmpp] Status: ${status}`);
      });

      xmpp.on('online', (address: any) => {
        const jidStr = address?.toString() || fullJid;
        console.log(`[xmpp] Online: ${jidStr}`);
        this.emitStatus(accountId, 'connected', undefined, jidStr);
        this.emit({ type: 'connected', accountId, jid: jidStr });
        // Send initial presence
        xmpp.send(xml('presence'));
      });

      xmpp.on('offline', () => {
        console.log(`[xmpp] Offline: ${accountId}`);
        this.emitStatus(accountId, 'disconnected');
      });

      xmpp.on('error', (err: any) => {
        const message = err?.message || err?.condition || String(err);
        console.error(`[xmpp] Error: ${accountId}`, message);

        let code = 'CONNECT_FAILED';
        let details = message;

        if (message.includes('not-authorized') || message.includes('auth') || message.includes('SASL')) {
          code = 'AUTH_FAILED';
          details = 'Authentication failed — check your username and password.';
        } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
          details = `Cannot resolve "${server}". Check the domain and your internet connection.`;
        } else if (message.includes('ECONNREFUSED')) {
          details = `Connection refused by ${server}:${port}. The XMPP server may be down.`;
        } else if (message.includes('ETIMEDOUT')) {
          details = `Connection to ${server}:${port} timed out. Check your network or firewall.`;
        } else if (message.includes('ECONNRESET')) {
          details = `Connection reset by ${server}:${port}.`;
        } else if (message.includes('certificate') || message.includes('SSL') || message.includes('TLS') || message.includes('ERR_TLS')) {
          details = `TLS error connecting to ${server}. The server's certificate may be invalid or self-signed.`;
        }

        this.emitStatus(accountId, 'error', details);
        this.emit({
          type: 'error',
          accountId,
          code,
          message: 'Connection error',
          details,
        });
      });

      await xmpp.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error(`[xmpp] Start error: ${accountId}`, message);

      this.emitStatus(accountId, 'error', message);
      this.emit({
        type: 'error',
        accountId,
        code: 'CONNECT_FAILED',
        message: 'Failed to connect',
        details: message,
      });
    }
  }

  async disconnect(accountId: string) {
    const conn = this.connections.get(accountId);
    if (conn) {
      try {
        await conn.xmpp.stop();
      } catch { /* already disconnected */ }
      this.connections.delete(accountId);
      this.emitStatus(accountId, 'disconnected');
    }
  }

  getStatus(accountId: string): AccountStatus {
    const conn = this.connections.get(accountId);
    return conn?.status ?? { accountId, state: 'disconnected' };
  }
}
