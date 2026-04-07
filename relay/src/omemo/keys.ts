// @ts-nocheck
import {
  KeyHelper,
} from '@privacyresearch/libsignal-protocol-typescript';
import type {
  KeyPairType,
  PreKeyPairType,
  SignedPreKeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript';
import type { SignalStore } from './store.js';

/** Generate a random 31-bit device ID (OMEMO convention: non-zero, fits in signed 32-bit int) */
export function generateDeviceId(): number {
  return Math.floor(Math.random() * 0x7ffffffe) + 1;
}

export async function generateIdentityKeyPair(): Promise<KeyPairType> {
  return KeyHelper.generateIdentityKeyPair();
}

export function generateRegistrationId(): number {
  return KeyHelper.generateRegistrationId();
}

/**
 * Generate `count` pre-keys starting at `startId`.
 */
export async function generatePreKeys(
  startId: number,
  count: number
): Promise<PreKeyPairType[]> {
  const keys: PreKeyPairType[] = [];
  for (let i = 0; i < count; i++) {
    const key = await KeyHelper.generatePreKey(startId + i);
    keys.push(key);
  }
  return keys;
}

export async function generateSignedPreKey(
  identityKeyPair: KeyPairType,
  id: number
): Promise<SignedPreKeyPairType> {
  return KeyHelper.generateSignedPreKey(identityKeyPair, id);
}

/**
 * Fully initializes a SignalStore with a fresh identity, registration ID,
 * 100 pre-keys and 1 signed pre-key.
 * Returns the deviceId, preKeys, and signedPreKey so the caller can publish them.
 */
export async function initializeStore(store: SignalStore): Promise<{
  deviceId: number;
  preKeys: PreKeyPairType[];
  signedPreKey: SignedPreKeyPairType;
}> {
  const identityKeyPair = await generateIdentityKeyPair();
  const registrationId = generateRegistrationId();
  const deviceId = generateDeviceId();

  store.setIdentityKeyPair(identityKeyPair);
  store.setLocalRegistrationId(registrationId);

  const preKeys = await generatePreKeys(1, 100);
  for (const pk of preKeys) {
    await store.storePreKey(pk.keyId, pk.keyPair);
  }

  const signedPreKey = await generateSignedPreKey(identityKeyPair, 1);
  await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

  return { deviceId, preKeys, signedPreKey };
}
