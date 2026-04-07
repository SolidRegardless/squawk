import type { AccountConfig, AccountStatus } from './account.js';

// ── Shared types ────────────────────────────────────────────

export interface Contact {
  jid: string;
  name?: string;
  subscription?: string;
  groups: string[];
  presence: PresenceInfo;
}

export interface PresenceInfo {
  show: 'chat' | 'away' | 'xa' | 'dnd' | 'offline';
  status?: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  /** For MUC: the sender's nickname */
  nick?: string;
  /** Whether this was sent by us */
  mine?: boolean;
  /** Delivery status for outgoing 1:1 messages */
  status?: 'sent' | 'delivered';
}

export interface RoomInfo {
  jid: string;
  name: string;
  description?: string;
  occupants?: number;
}

export interface RoomDetail {
  jid: string;
  name: string;
  subject?: string;
  participants: string[];
}

// ── Client → Relay ──────────────────────────────────────────

export interface ConnectMessage {
  type: 'connect';
  accountId: string;
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

export interface RosterGetMessage {
  type: 'roster:get';
}

export interface PresenceSetMessage {
  type: 'presence:set';
  show: PresenceInfo['show'];
  status?: string;
}

export interface MessageSendMessage {
  type: 'message:send';
  to: string;
  body: string;
}

export interface MucListMessage {
  type: 'muc:list';
  server: string;
}

export interface MucJoinMessage {
  type: 'muc:join';
  room: string;
  nick: string;
}

export interface MucLeaveMessage {
  type: 'muc:leave';
  room: string;
}

export interface MucSendMessage {
  type: 'muc:send';
  room: string;
  body: string;
}

export interface TypingSetMessage {
  type: 'typing:set';
  to: string;
  state: string;
  isRoom?: boolean;
}

export type ClientMessage =
  | ConnectMessage
  | DisconnectMessage
  | AccountSyncMessage
  | RosterGetMessage
  | PresenceSetMessage
  | MessageSendMessage
  | MucListMessage
  | MucJoinMessage
  | MucLeaveMessage
  | MucSendMessage
  | TypingSetMessage;

// ── Relay → Client ──────────────────────────────────────────

export interface StatusMessage {
  type: 'status';
  status: AccountStatus;
}

export interface ConnectedMessage {
  type: 'connected';
  accountId: string;
  jid: string;
}

export interface StepMessage {
  type: 'step';
  accountId: string;
  step: 'relay' | 'resolve' | 'handshake' | 'auth' | 'roster';
  status: 'active' | 'done' | 'error';
}

export interface ErrorMessage {
  type: 'error';
  accountId?: string;
  code: string;
  message: string;
  details?: string;
}

export interface RosterMessage {
  type: 'roster';
  contacts: Contact[];
}

export interface PresenceMessage {
  type: 'presence';
  jid: string;
  presence: PresenceInfo;
}

export interface IncomingMessage {
  type: 'message';
  message: ChatMessage;
}

export interface MucRoomsMessage {
  type: 'muc:rooms';
  server: string;
  rooms: RoomInfo[];
}

export interface MucJoinedMessage {
  type: 'muc:joined';
  room: RoomDetail;
}

export interface MucMessageMessage {
  type: 'muc:message';
  room: string;
  message: ChatMessage;
}

export interface MucPresenceMessage {
  type: 'muc:presence';
  room: string;
  nick: string;
  action: 'join' | 'leave';
  jid?: string;
}

export interface TypingMessage {
  type: 'typing';
  jid: string;
  isRoom: boolean;
  state: 'composing' | 'paused' | 'active' | 'inactive' | 'gone';
}

export interface ReceiptMessage {
  type: 'receipt';
  id: string;
  from: string;
}

export type RelayMessage =
  | StatusMessage
  | ConnectedMessage
  | StepMessage
  | ErrorMessage
  | RosterMessage
  | PresenceMessage
  | IncomingMessage
  | MucRoomsMessage
  | MucJoinedMessage
  | MucMessageMessage
  | MucPresenceMessage
  | TypingMessage
  | ReceiptMessage;

// ── Union ───────────────────────────────────────────────────

export type SquawkMessage = ClientMessage | RelayMessage;
