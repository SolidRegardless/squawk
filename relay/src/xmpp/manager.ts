// @ts-nocheck — @xmpp/client has limited TS types
import { client, xml, jid } from '@xmpp/client';
import type { AccountConfig, AccountStatus } from '../../../shared/src/account.js';
import type { RelayMessage, Contact, ChatMessage, RoomInfo, PresenceInfo } from '../../../shared/src/messages.js';

type EventCallback = (msg: RelayMessage) => void;

interface ManagedConnection {
  xmpp: any;
  accountId: string;
  status: AccountStatus;
  fullJid?: string;
  bareJid?: string;
  nick?: string;
}

export class XmppManager {
  private connections = new Map<string, ManagedConnection>();
  private accounts = new Map<string, AccountConfig>();
  private listeners = new Set<EventCallback>();
  private activeAccountId: string | null = null;
  private contacts = new Map<string, Contact>();
  private joinedRooms = new Set<string>();

  onEvent(cb: EventCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(msg: RelayMessage) {
    for (const cb of this.listeners) {
      try { cb(msg); } catch { /* swallow */ }
    }
  }

  private emitStep(accountId: string, step: string, status: string) {
    this.emit({ type: 'step', accountId, step, status } as RelayMessage);
  }

  private emitStatus(accountId: string, state: AccountStatus['state'], error?: string, jidStr?: string) {
    const status: AccountStatus = { accountId, state, error, jid: jidStr };
    this.emit({ type: 'status', status });
    const conn = this.connections.get(accountId);
    if (conn) conn.status = status;
  }

  private getActive(): ManagedConnection | undefined {
    if (!this.activeAccountId) return undefined;
    return this.connections.get(this.activeAccountId);
  }

  syncAccounts(accounts: AccountConfig[]) {
    this.accounts.clear();
    for (const acc of accounts) {
      this.accounts.set(acc.id, acc);
    }
    console.log(`[xmpp] Synced ${accounts.length} account(s)`);
  }

  // ── Roster ──────────────────────────────────────────────────

  async getRoster() {
    const conn = this.getActive();
    if (!conn) return;

    try {
      console.log('[xmpp] Fetching roster...');
      const rosterIq = xml('iq', { type: 'get' },
        xml('query', { xmlns: 'jabber:iq:roster' })
      );
      const result = await conn.xmpp.iqCaller.request(rosterIq);
      const items = result.getChild('query')?.getChildren('item') || [];
      
      this.contacts.clear();
      const contacts: Contact[] = items.map((item: any) => {
        const contact: Contact = {
          jid: item.attrs.jid,
          name: item.attrs.name || item.attrs.jid.split('@')[0],
          subscription: item.attrs.subscription,
          groups: (item.getChildren('group') || []).map((g: any) => g.text()),
          presence: { show: 'offline' },
        };
        this.contacts.set(contact.jid, contact);
        return contact;
      });

      console.log(`[xmpp] Roster: ${contacts.length} contacts`);
      this.emit({ type: 'roster', contacts });
    } catch (err) {
      console.error('[xmpp] Roster fetch error:', err);
    }
  }

  // ── Presence ────────────────────────────────────────────────

  async setPresence(show: PresenceInfo['show'], statusText?: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      if (show === 'offline') {
        await conn.xmpp.send(xml('presence', { type: 'unavailable' }));
      } else {
        const children: any[] = [];
        if (show !== 'chat') children.push(xml('show', {}, show));
        if (statusText) children.push(xml('status', {}, statusText));
        await conn.xmpp.send(xml('presence', {}, ...children));
      }
      console.log(`[xmpp] Presence set: ${show} ${statusText || ''}`);
    } catch (err) {
      console.error('[xmpp] Set presence error:', err);
    }
  }

  // ── 1:1 Messages ───────────────────────────────────────────

  async sendMessage(to: string, body: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      const id = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await conn.xmpp.send(
        xml('message', { to, type: 'chat', id },
          xml('body', {}, body),
          xml('request', { xmlns: 'urn:xmpp:receipts' })
        )
      );
      console.log(`[xmpp] Message sent to ${to}`);

      // Echo back to client
      this.emit({
        type: 'message',
        message: {
          id,
          from: conn.bareJid || '',
          to,
          body,
          timestamp: new Date().toISOString(),
          mine: true,
          status: 'sent',
        },
      });
    } catch (err) {
      console.error('[xmpp] Send message error:', err);
    }
  }

  // ── MUC ─────────────────────────────────────────────────────

  async listRooms(server: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      console.log(`[xmpp] Listing rooms on ${server}...`);
      const discoIq = xml('iq', { to: server, type: 'get' },
        xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' })
      );
      const result = await conn.xmpp.iqCaller.request(discoIq);
      const items = result.getChild('query')?.getChildren('item') || [];
      
      const rooms: RoomInfo[] = items.map((item: any) => ({
        jid: item.attrs.jid,
        name: item.attrs.name || item.attrs.jid.split('@')[0],
      }));

      console.log(`[xmpp] Found ${rooms.length} rooms on ${server}`);
      this.emit({ type: 'muc:rooms', server, rooms });
    } catch (err) {
      console.error('[xmpp] List rooms error:', err);
      this.emit({
        type: 'error',
        code: 'MUC_LIST_FAILED',
        message: `Failed to list rooms on ${server}`,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async joinRoom(roomJid: string, nick: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      console.log(`[xmpp] Joining room ${roomJid} as ${nick}...`);
      await conn.xmpp.send(
        xml('presence', { to: `${roomJid}/${nick}` },
          xml('x', { xmlns: 'http://jabber.org/protocol/muc' })
        )
      );
      this.joinedRooms.add(roomJid);
      // The server will respond with presence stanzas for participants
      // and a subject message — we handle those in the stanza handler
    } catch (err) {
      console.error('[xmpp] Join room error:', err);
    }
  }

  async leaveRoom(roomJid: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      const nick = conn.nick || conn.xmpp.options?.username || 'squawk';
      await conn.xmpp.send(
        xml('presence', { to: `${roomJid}/${nick}`, type: 'unavailable' })
      );
      this.joinedRooms.delete(roomJid);
      console.log(`[xmpp] Left room ${roomJid}`);
    } catch (err) {
      console.error('[xmpp] Leave room error:', err);
    }
  }

  async sendMucMessage(roomJid: string, body: string) {
    const conn = this.getActive();
    if (!conn) return;

    try {
      const id = `sq-muc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await conn.xmpp.send(
        xml('message', { to: roomJid, type: 'groupchat', id },
          xml('body', {}, body)
        )
      );
      console.log(`[xmpp] MUC message sent to ${roomJid}`);
      // Don't echo — server reflects groupchat messages back
    } catch (err) {
      console.error('[xmpp] MUC send error:', err);
    }
  }

  // ── Connect ─────────────────────────────────────────────────

  async connect(accountId: string, passwordOverride?: string) {
    await this.disconnect(accountId);

    const account = this.accounts.get(accountId);
    if (!account) {
      this.emit({ type: 'error', accountId, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' });
      return;
    }

    const password = passwordOverride || account.password;
    if (!password) {
      this.emit({ type: 'error', accountId, code: 'NO_PASSWORD', message: 'Password required.' });
      return;
    }

    const resource = account.resource || `squawk-${Date.now().toString(36)}`;
    const fullJid = `${account.username}@${account.domain}/${resource}`;
    const bareJid = `${account.username}@${account.domain}`;
    const server = account.connectServer || account.domain;
    const port = account.port || 5222;

    this.emitStatus(accountId, 'connecting');
    this.emitStep(accountId, 'relay', 'done');
    this.emitStep(accountId, 'resolve', 'active');

    console.log(`[xmpp] ═══════════════════════════════════════════════`);
    console.log(`[xmpp] Connecting ${fullJid} → ${server}:${port}`);
    console.log(`[xmpp] ═══════════════════════════════════════════════`);

    try {
      const xmpp = client({
        service: `xmpp://${server}:${port}`,
        domain: account.domain,
        resource,
        username: account.username,
        password,
      });

      const managed: ManagedConnection = {
        xmpp, accountId,
        status: { accountId, state: 'connecting' },
        fullJid, bareJid, nick: account.username,
      };
      this.connections.set(accountId, managed);
      this.activeAccountId = accountId;

      // ── Status tracking ───────────────────────────
      xmpp.on('status', (status: string) => {
        console.log(`[xmpp] Status: ${status}`);
        switch (status) {
          case 'connecting':
            this.emitStep(accountId, 'resolve', 'active');
            break;
          case 'connect':
            this.emitStep(accountId, 'resolve', 'done');
            this.emitStep(accountId, 'handshake', 'active');
            break;
          case 'open':
            this.emitStep(accountId, 'handshake', 'done');
            this.emitStep(accountId, 'auth', 'active');
            break;
          case 'online':
            setTimeout(() => {
              this.emitStep(accountId, 'auth', 'done');
              this.emitStep(accountId, 'roster', 'active');
            }, 300);
            setTimeout(() => {
              this.emitStep(accountId, 'roster', 'done');
            }, 700);
            break;
        }
      });

      // ── Verbose logging ───────────────────────────
      xmpp.on('input', (data: string) => console.log(`[xmpp] ← RECV:`, data.substring(0, 300)));
      xmpp.on('output', (data: string) => console.log(`[xmpp] → SEND:`, data.substring(0, 300)));

      // ── Online ────────────────────────────────────
      xmpp.on('online', (address: any) => {
        const jidStr = address?.toString() || fullJid;
        console.log(`[xmpp] Online: ${jidStr}`);
        managed.fullJid = jidStr;
        managed.bareJid = jidStr.split('/')[0];
        
        this.emitStatus(accountId, 'connected', undefined, jidStr);
        this.emit({ type: 'connected', accountId, jid: jidStr });
        
        // Send presence and fetch roster
        xmpp.send(xml('presence'));
        setTimeout(() => this.getRoster(), 500);
      });

      // ── Offline ───────────────────────────────────
      xmpp.on('offline', () => {
        console.log(`[xmpp] Offline: ${accountId}`);
        this.emitStatus(accountId, 'disconnected');
      });

      // ── Stanza handling ───────────────────────────
      xmpp.on('stanza', (stanza: any) => {
        this.handleStanza(stanza, managed);
      });

      // ── Errors ────────────────────────────────────
      xmpp.on('error', (err: any) => {
        const message = err?.message || err?.condition || String(err);
        console.error(`[xmpp] Error:`, message);

        let code = 'CONNECT_FAILED';
        let details = message;

        if (message.includes('not-authorized') || message.includes('SASL')) {
          code = 'AUTH_FAILED';
          details = 'Authentication failed — check your username and password.';
          this.emitStep(accountId, 'auth', 'error');
        } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
          details = `Cannot resolve "${server}". Check the domain.`;
          this.emitStep(accountId, 'resolve', 'error');
        } else if (message.includes('ECONNREFUSED')) {
          details = `Connection refused by ${server}:${port}.`;
          this.emitStep(accountId, 'resolve', 'error');
        } else if (message.includes('ETIMEDOUT')) {
          details = `Connection to ${server}:${port} timed out.`;
          this.emitStep(accountId, 'resolve', 'error');
        }

        this.emitStatus(accountId, 'error', details);
        this.emit({ type: 'error', accountId, code, message: 'Connection error', details });
      });

      await xmpp.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error(`[xmpp] Start error:`, message);
      this.emitStep(accountId, 'resolve', 'error');
      this.emitStatus(accountId, 'error', message);
      this.emit({ type: 'error', accountId, code: 'CONNECT_FAILED', message: 'Failed to connect', details: message });
    }
  }

  // ── Stanza handler ──────────────────────────────────────────

  private handleStanza(stanza: any, conn: ManagedConnection) {
    const type = stanza.name;

    if (type === 'message') {
      this.handleMessage(stanza, conn);
    } else if (type === 'presence') {
      this.handlePresence(stanza, conn);
    }
  }

  async sendTyping(to: string, state: string) {
    const conn = this.getActive();
    if (!conn) return;
    try {
      await conn.xmpp.send(
        xml('message', { to, type: 'chat' },
          xml(state, { xmlns: 'http://jabber.org/protocol/chatstates' })
        )
      );
    } catch (err) {
      console.error('[xmpp] Send typing error:', err);
    }
  }

  async sendMucTyping(room: string, state: string) {
    const conn = this.getActive();
    if (!conn) return;
    try {
      await conn.xmpp.send(
        xml('message', { to: room, type: 'groupchat' },
          xml(state, { xmlns: 'http://jabber.org/protocol/chatstates' })
        )
      );
    } catch (err) {
      console.error('[xmpp] Send MUC typing error:', err);
    }
  }

  private handleMessage(stanza: any, conn: ManagedConnection) {
    const from = stanza.attrs.from || '';
    const msgType = stanza.attrs.type;
    const body = stanza.getChildText('body');
    const id = stanza.attrs.id || `rx-${Date.now()}`;

    // XEP-0184: incoming delivery receipt acknowledgment
    const received = stanza.getChild('received', 'urn:xmpp:receipts');
    if (received) {
      const receiptId = received.attrs.id;
      if (receiptId) {
        const bareFrom = from.split('/')[0];
        console.log(`[xmpp] Receipt for ${receiptId} from ${bareFrom}`);
        this.emit({ type: 'receipt', id: receiptId, from: bareFrom });
      }
      return;
    }

    // Detect chat state notifications (XEP-0085)
    const CSN_NS = 'http://jabber.org/protocol/chatstates';
    for (const state of ['composing', 'paused', 'active', 'inactive', 'gone'] as const) {
      if (stanza.getChild(state, CSN_NS)) {
        const isRoom = msgType === 'groupchat';
        const bareFrom = from.split('/')[0];
        this.emit({ type: 'typing', jid: bareFrom, isRoom, state });
        break;
      }
    }

    // Skip empty messages (e.g. chat state notifications)
    if (!body) {
      // Check for MUC subject
      const subject = stanza.getChildText('subject');
      if (subject !== null && subject !== undefined && msgType === 'groupchat') {
        const roomJid = from.split('/')[0];
        console.log(`[xmpp] Room subject for ${roomJid}: ${subject}`);
        this.emit({
          type: 'muc:joined',
          room: { jid: roomJid, name: roomJid.split('@')[0], subject, participants: [] },
        });
      }
      return;
    }

    if (msgType === 'groupchat') {
      // MUC message
      const roomJid = from.split('/')[0];
      const nick = from.split('/')[1] || '';
      const mine = nick === conn.nick;

      // Skip history duplicates via delay
      const delay = stanza.getChild('delay');
      const timestamp = delay?.attrs?.stamp || new Date().toISOString();

      this.emit({
        type: 'muc:message',
        room: roomJid,
        message: { id, from: roomJid, to: '', body, timestamp, nick, mine },
      });
    } else if (msgType === 'chat' || !msgType) {
      // 1:1 message
      const bareFrom = from.split('/')[0];
      const mine = bareFrom === conn.bareJid;

      // XEP-0184: auto-send receipt if requested (only for messages from others)
      if (!mine) {
        const request = stanza.getChild('request', 'urn:xmpp:receipts');
        if (request && stanza.attrs.id) {
          conn.xmpp.send(
            xml('message', { to: from },
              xml('received', { xmlns: 'urn:xmpp:receipts', id: stanza.attrs.id })
            )
          ).catch(() => {});
        }
      }

      this.emit({
        type: 'message',
        message: {
          id,
          from: bareFrom,
          to: mine ? (stanza.attrs.to || '').split('/')[0] : (conn.bareJid || ''),
          body,
          timestamp: new Date().toISOString(),
          mine,
        },
      });
    }
  }

  private handlePresence(stanza: any, conn: ManagedConnection) {
    const from = stanza.attrs.from || '';
    const type = stanza.attrs.type;
    
    // Check if it's a MUC presence
    const mucX = stanza.getChild('x', 'http://jabber.org/protocol/muc#user');
    if (mucX) {
      const roomJid = from.split('/')[0];
      const nick = from.split('/')[1] || '';
      
      if (type === 'unavailable') {
        this.emit({ type: 'muc:presence', room: roomJid, nick, action: 'leave' });
      } else {
        // Check for self-presence (110 status code = own join)
        const statuses = mucX.getChildren('status');
        const isSelf = statuses.some((s: any) => s.attrs.code === '110');
        
        this.emit({ type: 'muc:presence', room: roomJid, nick, action: 'join' });
        
        if (isSelf) {
          console.log(`[xmpp] Joined room ${roomJid} as ${nick}`);
          this.emit({
            type: 'muc:joined',
            room: { jid: roomJid, name: roomJid.split('@')[0], participants: [nick] },
          });
        }
      }
      return;
    }

    // Regular presence
    const bareFrom = from.split('/')[0];
    if (bareFrom === conn.bareJid) return; // Skip own presence

    let show: PresenceInfo['show'] = 'chat';
    if (type === 'unavailable') {
      show = 'offline';
    } else {
      const showEl = stanza.getChildText('show');
      if (showEl === 'away') show = 'away';
      else if (showEl === 'xa') show = 'xa';
      else if (showEl === 'dnd') show = 'dnd';
      else show = 'chat';
    }

    const statusText = stanza.getChildText('status');
    const presence: PresenceInfo = { show, status: statusText || undefined };

    // Update local cache
    const contact = this.contacts.get(bareFrom);
    if (contact) contact.presence = presence;

    this.emit({ type: 'presence', jid: bareFrom, presence });
  }

  // ── Disconnect ──────────────────────────────────────────────

  async disconnect(accountId: string) {
    const conn = this.connections.get(accountId);
    if (conn) {
      try { await conn.xmpp.stop(); } catch { /* already disconnected */ }
      this.connections.delete(accountId);
      if (this.activeAccountId === accountId) this.activeAccountId = null;
      this.contacts.clear();
      this.joinedRooms.clear();
      this.emitStatus(accountId, 'disconnected');
    }
  }

  getStatus(accountId: string): AccountStatus {
    const conn = this.connections.get(accountId);
    return conn?.status ?? { accountId, state: 'disconnected' };
  }
}
