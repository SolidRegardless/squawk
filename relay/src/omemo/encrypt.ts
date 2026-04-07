// @ts-nocheck
import { createCipheriv, randomBytes } from 'crypto';
import { xml } from '@xmpp/client';
import {
  SignalProtocolAddress,
  SessionCipher,
} from '@privacyresearch/libsignal-protocol-typescript';
import type { StorageType } from '@privacyresearch/libsignal-protocol-typescript';

const AES_KEY_BYTES = 32;  // AES-256
const AUTH_TAG_BYTES = 16; // GCM auth tag
const IV_BYTES = 12;       // GCM recommended IV length
const KEY_MATERIAL_BYTES = AES_KEY_BYTES + AUTH_TAG_BYTES; // 48 bytes Signal-encrypted payload

/**
 * Encrypts `plaintext` for one or more recipient devices using OMEMO (XEP-0384).
 *
 * Returns the <encrypted> XML element ready to be embedded in a <message> stanza.
 *
 * Algorithm:
 *   1. Generate random AES-256 key + GCM IV.
 *   2. AES-256-GCM encrypt plaintext → ciphertext + authTag.
 *   3. For each recipient device, Signal-encrypt (aesKey || authTag) with SessionCipher.
 *   4. Build OMEMO <encrypted> stanza.
 *
 * TODO: handle devices with no open session by fetching their bundle and running
 *       X3DH key agreement via SessionBuilder before encrypting.
 */
export async function encryptMessage(
  plaintext: string,
  recipientJid: string,
  recipientDevices: Array<{ jid: string; deviceId: number }>,
  store: StorageType,
  ourDeviceId: number
): Promise<any> {
  // ── Step 1: Generate AES key + IV ────────────────────────────
  const aesKey = randomBytes(AES_KEY_BYTES);
  const iv = randomBytes(IV_BYTES);

  // ── Step 2: AES-256-GCM encrypt plaintext ────────────────────
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const encryptedPayload = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Key material sent to each device: AES key + auth tag (48 bytes total)
  const keyMaterial = Buffer.concat([aesKey, authTag]);

  // ── Step 3: Signal-encrypt key material for each device ──────
  const keyElements: any[] = [];

  for (const { jid, deviceId } of recipientDevices) {
    try {
      const address = new SignalProtocolAddress(jid, deviceId);
      const sessionCipher = new SessionCipher(store, address);

      // Check whether a session exists; skip devices with no session rather than failing
      const hasSession = await sessionCipher.hasOpenSession();
      if (!hasSession) {
        console.warn(`[omemo] No open session for ${jid}:${deviceId}, skipping`);
        // TODO: fetch bundle, run X3DH via SessionBuilder, then retry
        continue;
      }

      const encrypted = await sessionCipher.encrypt(
        keyMaterial.buffer.slice(
          keyMaterial.byteOffset,
          keyMaterial.byteOffset + keyMaterial.byteLength
        ) as ArrayBuffer
      );

      // type 3 = PreKeyWhisperMessage (first message), type 1 = WhisperMessage
      const isPreKey = encrypted.type === 3;
      const attrs: Record<string, string> = { rid: String(deviceId) };
      if (isPreKey) attrs.prekey = '1';

      keyElements.push(
        xml('key', attrs, encrypted.body ?? '')
      );
    } catch (err) {
      console.error(`[omemo] Failed to encrypt key for ${jid}:${deviceId}:`, err);
    }
  }

  if (keyElements.length === 0) {
    throw new Error('[omemo] No recipient devices could be encrypted to');
  }

  // ── Step 4: Build <encrypted> stanza ─────────────────────────
  const encryptedEl = xml(
    'encrypted',
    { xmlns: 'eu.siacs.conversations.axolotl' },
    xml(
      'header',
      { sid: String(ourDeviceId) },
      ...keyElements,
      xml('iv', {}, iv.toString('base64'))
    ),
    xml('payload', {}, encryptedPayload.toString('base64'))
  );

  return encryptedEl;
}
