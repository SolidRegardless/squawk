import type { AccountConfig, AccountStatus, AccountCreateInput } from './account.js';

// ── Client → Relay ──────────────────────────────────────────────

export interface ConnectMessage {
  type: 'connect';
  accountId: string;
  /** Required if password not saved on account */
  password?: string;
}

export interface DisconnectMessage {
  type: 'disconnect';
  accountId: string;
}

export interface AccountSyncMessage {
  type: 'account:sync';
  accounts: AccountConfig[];
}

export type ClientMessage = ConnectMessage | DisconnectMessage | AccountSyncMessage;

// ── Relay → Client ──────────────────────────────────────────────

export interface StatusMessage {
  type: 'status';
  status: AccountStatus;
}

export interface ConnectedMessage {
  type: 'connected';
  accountId: string;
  jid: string;
}

export interface ErrorMessage {
  type: 'error';
  accountId?: string;
  code: string;
  message: string;
  details?: string;
}

export type RelayMessage = StatusMessage | ConnectedMessage | ErrorMessage;

// ── Union ───────────────────────────────────────────────────────

export type SquawkMessage = ClientMessage | RelayMessage;
