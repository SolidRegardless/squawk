export interface AccountConfig {
  id: string;
  protocol: 'xmpp';
  username: string;
  domain: string;
  resource?: string;
  savePassword: boolean;
  /** Only stored if savePassword is true */
  password?: string;
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
