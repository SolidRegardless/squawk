// @ts-nocheck
import { xml } from '@xmpp/client';
import type { SignalStore } from './store.js';
import type {
  PreKeyPairType,
  SignedPreKeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript';

/**
 * Publishes the OMEMO device list and bundle to PEP.
 *
 * TODO: merge with existing device list instead of overwriting — to support
 *       multiple devices (multi-client) for the same account.
 */
export async function publishDeviceBundle(
  xmpp: any,
  store: SignalStore,
  deviceId: number,
  preKeys: PreKeyPairType[],
  signedPreKey: SignedPreKeyPairType
): Promise<void> {
  const identityKeyPair = await store.getIdentityKeyPair();
  if (!identityKeyPair) {
    throw new Error('[omemo] Cannot publish bundle: identity key pair not found in store');
  }

  const toBase64 = (buf: ArrayBuffer): string =>
    Buffer.from(buf).toString('base64');

  // ── 1. Publish device list ────────────────────────────────────
  const deviceListIq = xml(
    'iq',
    { type: 'set' },
    xml(
      'pubsub',
      { xmlns: 'http://jabber.org/protocol/pubsub' },
      xml(
        'publish',
        { node: 'eu.siacs.conversations.axolotl.devicelist' },
        xml(
          'item',
          { id: 'current' },
          xml(
            'list',
            { xmlns: 'eu.siacs.conversations.axolotl' },
            xml('device', { id: String(deviceId) })
          )
        )
      )
    )
  );

  await xmpp.iqCaller.request(deviceListIq);
  console.log(`[omemo] Device list published, deviceId=${deviceId}`);

  // ── 2. Build pre-key elements ─────────────────────────────────
  const preKeyEls = preKeys.map((pk) =>
    xml('preKeyPublic', { preKeyId: String(pk.keyId) }, toBase64(pk.keyPair.pubKey))
  );

  // ── 3. Publish bundle ─────────────────────────────────────────
  const bundleIq = xml(
    'iq',
    { type: 'set' },
    xml(
      'pubsub',
      { xmlns: 'http://jabber.org/protocol/pubsub' },
      xml(
        'publish',
        { node: `eu.siacs.conversations.axolotl.bundles:${deviceId}` },
        xml(
          'item',
          { id: 'current' },
          xml(
            'bundle',
            { xmlns: 'eu.siacs.conversations.axolotl' },
            xml(
              'signedPreKeyPublic',
              { signedPreKeyId: String(signedPreKey.keyId) },
              toBase64(signedPreKey.keyPair.pubKey)
            ),
            xml('signedPreKeySignature', {}, toBase64(signedPreKey.signature)),
            xml('identityKey', {}, toBase64(identityKeyPair.pubKey)),
            xml('prekeys', {}, ...preKeyEls)
          )
        )
      )
    )
  );

  await xmpp.iqCaller.request(bundleIq);
  console.log(`[omemo] Bundle published for deviceId=${deviceId}`);
}
