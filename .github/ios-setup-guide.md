# iOS CI/CD Setup Guide

This guide explains every GitHub secret required for the `ios.yml` workflow to
build Squawk and deliver it to TestFlight.

## Prerequisites

1. **Apple Developer account** with an active paid membership.
2. **App record created in App Store Connect** — the Bundle ID must be
   `com.solidregardless.squawk`. Create it at
   <https://appstoreconnect.apple.com> before the first run.
3. **App Identifier registered** in the Apple Developer portal with the same
   Bundle ID.

---

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**
for each item below.

### `BUILD_CERTIFICATE_BASE64`

The Apple Distribution (or iPhone Distribution) certificate used to sign the
app, encoded as base64.

**How to obtain:**

1. In Xcode or Keychain Access, request/export your **Apple Distribution**
   certificate as a `.p12` file (include the private key).
2. Base64-encode it:
   ```sh
   base64 -i Certificates.p12 | pbcopy
   ```
3. Paste the result as the secret value.

---

### `P12_PASSWORD`

The password you set when exporting the `.p12` certificate above.

---

### `BUILD_PROVISION_PROFILE_BASE64`

The **App Store** provisioning profile for `com.solidregardless.squawk`,
encoded as base64.

**How to obtain:**

1. Go to <https://developer.apple.com/account/resources/profiles/list>.
2. Create or download an **App Store Distribution** provisioning profile for
   the Squawk app ID.
3. Base64-encode the downloaded `.mobileprovision` file:
   ```sh
   base64 -i Squawk_AppStore.mobileprovision | pbcopy
   ```
4. Paste the result as the secret value.

---

### `APP_STORE_CONNECT_API_KEY_ID`

The **Key ID** of an App Store Connect API key (e.g. `ABC123DEF4`).

**How to obtain:**

1. In App Store Connect go to **Users and Access → Integrations → App Store
   Connect API**.
2. Generate a new key with **Developer** role (or higher).
3. Copy the **Key ID** shown in the table.

---

### `APP_STORE_CONNECT_API_KEY_ISSUER_ID`

The **Issuer ID** shown on the same App Store Connect API page (a UUID like
`57246542-96fe-1a63-e053-0824d011072a`).

---

### `APP_STORE_CONNECT_API_KEY_CONTENT`

The `.p8` private key file contents, base64-encoded.

**How to obtain:**

1. Download the `.p8` file immediately after creating the API key — Apple only
   lets you download it once.
2. Base64-encode it:
   ```sh
   base64 -i AuthKey_ABC123DEF4.p8 | pbcopy
   ```
3. Paste the result as the secret value.

---

### `CODE_SIGN_IDENTITY`

The full name of the signing identity as it appears in Keychain Access, e.g.:

```
iPhone Distribution: Stuart Hart (ABCDE12345)
```

To find it, run:
```sh
security find-identity -v -p codesigning
```

---

### `TEAM_ID`

Your 10-character Apple Developer Team ID (e.g. `ABCDE12345`).

Find it at <https://developer.apple.com/account> under **Membership details**.

---

### `BUNDLE_ID`

The app's Bundle Identifier:

```
com.solidregardless.squawk
```

This must match exactly what is registered in the Apple Developer portal and
App Store Connect.

---

## Summary table

| Secret | Where to find it |
|--------|-----------------|
| `BUILD_CERTIFICATE_BASE64` | Keychain Access → export .p12 → base64 |
| `P12_PASSWORD` | Password chosen during .p12 export |
| `BUILD_PROVISION_PROFILE_BASE64` | developer.apple.com → Profiles → base64 |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect → Users & Access → API |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | Same page as above |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Downloaded .p8 file → base64 |
| `CODE_SIGN_IDENTITY` | `security find-identity -v -p codesigning` |
| `TEAM_ID` | developer.apple.com → Membership |
| `BUNDLE_ID` | `com.solidregardless.squawk` |

---

## First-time checklist

- [ ] App record exists in App Store Connect with Bundle ID `com.solidregardless.squawk`
- [ ] App Identifier registered in the Apple Developer portal
- [ ] Apple Distribution certificate in your keychain (not expired)
- [ ] App Store provisioning profile downloaded and not expired
- [ ] App Store Connect API key generated (Developer role or higher)
- [ ] All 9 secrets added to the GitHub repository
- [ ] `client/ios/` directory is in `.gitignore` (already done)
