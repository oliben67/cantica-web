// Device signing key for cantica-secure key-based auth.
//
// Invited accounts have no password — they authenticate with an RSA key pair
// enrolled during invite acceptance. We persist the private key (as a JWK) and
// the cantica_user_id in localStorage so the session can be refreshed by
// re-asserting when the access token expires.

import { SecureClient, createAuthAssertion, createFetchTransport } from "@cantica/secure-ui";

const KEY = "cantica_device_key";
const TOKEN_KEY = "cantica_token";

interface StoredKey {
  canticaUserId: string;
  jwk: JsonWebKey;
}

export async function saveDeviceKey(canticaUserId: string, privateKey: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  localStorage.setItem(KEY, JSON.stringify({ canticaUserId, jwk } satisfies StoredKey));
}

export function clearDeviceKey(): void {
  localStorage.removeItem(KEY);
}

export function hasDeviceKey(): boolean {
  return localStorage.getItem(KEY) !== null;
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk", jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

/** Re-authenticate with the stored device key; stores a fresh access token.
 *  Returns the token, or null if no device key / the key was rejected. */
export async function reAssertSession(): Promise<string | null> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const { canticaUserId, jwk } = JSON.parse(raw) as StoredKey;
    const privateKey = await importPrivateKey(jwk);
    const assertion = await createAuthAssertion(privateKey, canticaUserId);
    const client = new SecureClient(createFetchTransport({ baseUrl: "/" }));
    const session = await client.assert(assertion);
    localStorage.setItem(TOKEN_KEY, session.access_token);
    return session.access_token;
  } catch {
    clearDeviceKey();
    return null;
  }
}
