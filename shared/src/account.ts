export type XmppTransport = 'tcp' | 'websocket' | 'bosh';
export type XmppSecurity = 'require-tls' | 'allow-plaintext' | 'none';

export interface AccountConfig {
  id: string;
  protocol: 'xmpp';
  username: string;
  domain: string;
  resource?: string;
  savePassword: boolean;
  /** Only stored if savePassword is true */
  password?: string;
  /** Connection transport — default tcp (standard XMPP) */
  transport?: XmppTransport;
  /** Port — default 5222 for tcp, 5281 for websocket/bosh */
  port?: number;
  /** TLS security — default require-tls */
  security?: XmppSecurity;
  /** Custom connect server (if different from domain) */
  connectServer?: string;
  /** BOSH URL (only for bosh transport) */
  boshUrl?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last use */
  lastUsedAt?: string;
}

export interface AccountStatus {
  accountId: string;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  jid?: string;
}

export type AccountCreateInput = Omit<AccountConfig, 'id' | 'createdAt' | 'lastUsedAt'>;
