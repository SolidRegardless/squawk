// @ts-nocheck
import { createDecipheriv } from 'crypto';
import {
  SignalProtocolAddress,
  SessionCipher,
} from '@privacyresearch/libsignal-protocol-typescript';
import type { StorageType } from '@privacyresearch/libsignal-protocol-typescript';

const AES_KEY_BYTES = 32;  // AES-256
const AUTH_TAG_BYTES = 16; // GCM auth tag

/**
 * Decrypts an OMEMO <encrypted> XML element.
 *
 * Algorithm:
 *   1. Find the <key rid="{ourDeviceId}"> in the header.
 *   2. Signal-decrypt it (PreKeyWhisperMessage or WhisperMessage).
 *   3. Split recovered bytes → aesKey (32) + authTag (16).
 *   4. AES-256-GCM decrypt the payload.
 *   5. Return plaintext string.
 *
 * TODO: emit a key-agreement notification if TOFU detects a new identity key,
 *       to let the UI warn the user about identity changes.
 */
export async function decryptMessage(
  encryptedEl: any,
  senderJid: string,
  ourDeviceId: number,
  store: StorageType
): Promise<string> {
  const headerEl = encryptedEl.getChild('header');
  if (!headerEl) throw new Error('[omemo] Missing <header> in encrypted element');

  const senderDeviceId = parseInt(headerEl.attrs?.sid || '0', 10);
  if (!senderDeviceId) throw new Error('[omemo] Missing or invalid sid in header');

  // Find the key element addressed to our device
  const keyEls: any[] = headerEl.getChildren('key') || [];
  const ourKeyEl = keyEls.find((k: any) => String(k.attrs?.rid) === String(ourDeviceId));
  if (!ourKeyEl) {
    throw new Error(`[omemo] No key element found for our deviceId=${ourDeviceId}`);
  }

  const isPreKey = ourKeyEl.attrs?.prekey === '1' || ourKeyEl.attrs?.prekey === true;
  const encryptedKeyB64: string = ourKeyEl.text() || ourKeyEl.getText?.() || '';
  if (!encryptedKeyB64) throw new Error('[omemo] Key element is empty');

  // IV is a child of header
  const ivB64: string = headerEl.getChildText('iv') || '';
  if (!ivB64) throw new Error('[omemo] Missing <iv> in header');

  // Payload is a direct child of <encrypted>
  const payloadB64: string = encryptedEl.getChildText('payload') || '';
  if (!payloadB64) throw new Error('[omemo] Missing <payload> in encrypted element');

  // ── Signal-decrypt the key material ──────────────────────────
  const address = new SignalProtocolAddress(senderJid, senderDeviceId);
  const sessionCipher = new SessionCipher(store, address);

  const encryptedKeyBuf = Buffer.from(encryptedKeyB64, 'base64');

  let keyMaterialBuf: ArrayBuffer;
  if (isPreKey) {
    keyMaterialBuf = await sessionCipher.decryptPreKeyWhisperMessage(
      encryptedKeyBuf.buffer.slice(
        encryptedKeyBuf.byteOffset,
        encryptedKeyBuf.byteOffset + encryptedKeyBuf.byteLength
      ) as ArrayBuffer,
      'binary'
    );
  } else {
    keyMaterialBuf = await sessionCipher.decryptWhisperMessage(
      encryptedKeyBuf.buffer.slice(
        encryptedKeyBuf.byteOffset,
        encryptedKeyBuf.byteOffset + encryptedKeyBuf.byteLength
      ) as ArrayBuffer,
      'binary'
    );
  }

  const keyMaterial = Buffer.from(keyMaterialBuf);

  if (keyMaterial.length < AES_KEY_BYTES + AUTH_TAG_BYTES) {
    throw new Error(
      `[omemo] Decrypted key material too short: ${keyMaterial.length} bytes, expected ${AES_KEY_BYTES + AUTH_TAG_BYTES}`
    );
  }

  const aesKey = keyMaterial.slice(0, AES_KEY_BYTES);
  const authTag = keyMaterial.slice(AES_KEY_BYTES, AES_KEY_BYTES + AUTH_TAG_BYTES);

  // ── AES-256-GCM decrypt payload ───────────────────────────────
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(payloadB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
