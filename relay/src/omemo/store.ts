// @ts-nocheck
import type {
  StorageType,
  KeyPairType,
  SessionRecordType,
  Direction,
} from '@privacyresearch/libsignal-protocol-typescript';

/**
 * In-memory Signal Protocol store for the relay.
 * Uses TOFU (Trust On First Use): the first identity key seen for an address is trusted.
 *
 * TODO: replace with persistent store (SQLite or file-based) for key rotation survival.
 */
export class SignalStore implements StorageType {
  private identityKeyPair: KeyPairType | undefined;
  private localRegistrationId: number | undefined;

  // address string -> ArrayBuffer (public key)
  private identityKeys = new Map<string, ArrayBuffer>();

  // keyId -> KeyPairType
  private preKeys = new Map<number | string, KeyPairType>();

  // keyId -> KeyPairType
  private signedPreKeys = new Map<number | string, KeyPairType>();

  // encodedAddress -> SessionRecordType (serialized string)
  private sessions = new Map<string, SessionRecordType>();

  // ── Identity key pair ────────────────────────────────────────

  setIdentityKeyPair(pair: KeyPairType): void {
    this.identityKeyPair = pair;
  }

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    return this.identityKeyPair;
  }

  // ── Registration ID ─────────────────────────────────────────

  setLocalRegistrationId(id: number): void {
    this.localRegistrationId = id;
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.localRegistrationId;
  }

  // ── Identity keys (TOFU) ─────────────────────────────────────

  /**
   * TOFU: trust any identity on first use; trust subsequent ones only if they match.
   */
  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction
  ): Promise<boolean> {
    const existing = this.identityKeys.get(identifier);
    if (!existing) {
      // First time we see this identity — trust it (TOFU)
      return true;
    }
    // Compare byte-by-byte
    const a = new Uint8Array(existing);
    const b = new Uint8Array(identityKey);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    _nonblockingApproval?: boolean
  ): Promise<boolean> {
    // encodedAddress is "name.deviceId" — strip device id to get the JID key
    const identifier = encodedAddress.split('.')[0];
    const existing = this.identityKeys.get(identifier);
    this.identityKeys.set(identifier, publicKey);
    if (!existing) return false; // new identity
    const a = new Uint8Array(existing);
    const b = new Uint8Array(publicKey);
    if (a.length !== b.length) return true; // changed
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true; // changed
    }
    return false; // unchanged
  }

  async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
    return this.identityKeys.get(identifier);
  }

  // ── Pre-keys ─────────────────────────────────────────────────

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    return this.preKeys.get(keyId);
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    this.preKeys.set(keyId, keyPair);
  }

  async removePreKey(keyId: number | string): Promise<void> {
    this.preKeys.delete(keyId);
  }

  /** Returns all stored pre-keys. Used when building the device bundle. */
  getAllPreKeys(): Array<{ keyId: number | string; keyPair: KeyPairType }> {
    return Array.from(this.preKeys.entries()).map(([keyId, keyPair]) => ({ keyId, keyPair }));
  }

  // ── Signed pre-keys ──────────────────────────────────────────

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    return this.signedPreKeys.get(keyId);
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    this.signedPreKeys.set(keyId, keyPair);
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    this.signedPreKeys.delete(keyId);
  }

  // ── Sessions ─────────────────────────────────────────────────

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    return this.sessions.get(encodedAddress);
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    this.sessions.set(encodedAddress, record);
  }

  async removeSession(encodedAddress: string): Promise<void> {
    this.sessions.delete(encodedAddress);
  }

  async removeAllSessions(identifier: string): Promise<void> {
    for (const key of this.sessions.keys()) {
      if (key.startsWith(`${identifier}.`)) {
        this.sessions.delete(key);
      }
    }
  }
}
