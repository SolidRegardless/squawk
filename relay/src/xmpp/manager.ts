import { createClient, Agent } from 'stanza';
import type { AccountConfig, AccountStatus } from '../../../shared/src/account.js';
import type { RelayMessage } from '../../../shared/src/messages.js';

type EventCallback = (msg: RelayMessage) => void;

interface ManagedConnection {
  client: Agent;
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

  private emitStatus(accountId: string, state: AccountStatus['state'], error?: string, jid?: string) {
    const status: AccountStatus = { accountId, state, error, jid };
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
    const jid = `${account.username}@${account.domain}/${resource}`;
    const transport = account.transport || 'tcp';
    const port = account.port || (transport === 'tcp' ? 5222 : 5281);
    const server = account.connectServer || account.domain;
    const security = account.security || 'require-tls';

    this.emitStatus(accountId, 'connecting');
    console.log(`[xmpp] Connecting ${jid} via ${transport}:${port} to ${server} (security: ${security})`);

    try {
      // Build transport config based on type
      const clientConfig: any = {
        jid,
        password,
      };

      if (transport === 'tcp') {
        // Standard XMPP over TCP (port 5222)
        clientConfig.transports = {
          tcp: {
            host: server,
            port,
          },
        };
        // TLS settings
        if (security === 'require-tls') {
          clientConfig.tls = {
            rejectUnauthorized: false, // Many Jabber servers use self-signed certs
          };
        } else if (security === 'none') {
          clientConfig.tls = false;
        }
      } else if (transport === 'websocket') {
        const wsScheme = security === 'none' ? 'ws' : 'wss';
        clientConfig.transports = {
          websocket: `${wsScheme}://${server}:${port}/xmpp-websocket`,
        };
      } else if (transport === 'bosh') {
        const httpScheme = security === 'none' ? 'http' : 'https';
        const boshUrl = account.boshUrl || `${httpScheme}://${server}:${port}/http-bind`;
        clientConfig.transports = {
          bosh: boshUrl,
        };
      }

      const client = createClient(clientConfig);

      const managed: ManagedConnection = {
        client,
        accountId,
        status: { accountId, state: 'connecting' },
      };
      this.connections.set(accountId, managed);

      client.on('session:started', () => {
        console.log(`[xmpp] Connected: ${jid}`);
        this.emitStatus(accountId, 'connected', undefined, jid);
        this.emit({ type: 'connected', accountId, jid });
        // Send initial presence
        client.sendPresence();
      });

      client.on('disconnected', () => {
        console.log(`[xmpp] Disconnected: ${accountId}`);
        this.emitStatus(accountId, 'disconnected');
      });

      client.on('auth:failed', () => {
        console.log(`[xmpp] Auth failed: ${accountId}`);
        this.emitStatus(accountId, 'error', 'Authentication failed — check username/password');
        this.emit({
          type: 'error',
          accountId,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          details: 'Check your username and password. Ensure the account exists on the XMPP server.',
        });
      });

      client.on('stream:error', (err) => {
        const detail = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err);
        console.log(`[xmpp] Stream error: ${accountId}`, detail);
        this.emitStatus(accountId, 'error', `Stream error: ${detail}`);
        this.emit({
          type: 'error',
          accountId,
          code: 'STREAM_ERROR',
          message: 'XMPP stream error',
          details: detail,
        });
      });

      await client.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error(`[xmpp] Connect error: ${accountId}`, message);

      let details = message;
      if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
        details = `Cannot resolve "${server}". Check the domain name and your internet connection.`;
      } else if (message.includes('ECONNREFUSED')) {
        details = `Connection refused by ${server}:${port}. The XMPP server may be down or not listening on port ${port}.`;
      } else if (message.includes('ETIMEDOUT')) {
        details = `Connection to ${server}:${port} timed out. Check your network or firewall settings.`;
      } else if (message.includes('certificate') || message.includes('SSL') || message.includes('TLS')) {
        details = `TLS/SSL error connecting to ${server}. The server's certificate may be invalid. Try setting security to "allow-plaintext" if the server doesn't support TLS.`;
      } else if (message.includes('ECONNRESET')) {
        details = `Connection reset by ${server}:${port}. The server closed the connection unexpectedly.`;
      }

      this.emitStatus(accountId, 'error', details);
      this.emit({
        type: 'error',
        accountId,
        code: 'CONNECT_FAILED',
        message: 'Failed to connect',
        details,
      });
    }
  }

  async disconnect(accountId: string) {
    const conn = this.connections.get(accountId);
    if (conn) {
      try {
        await conn.client.disconnect();
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
