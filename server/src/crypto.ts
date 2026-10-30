/**
 * Credential encryption.
 *
 * Provider API keys and integration tokens are only ever written to D1 as
 * AES-256-GCM ciphertext. The key is derived from the GATEWAY_SECRET variable
 * with PBKDF2 and cached per isolate. Plaintext never leaves this module, is
 * never logged and is never returned to a client.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = enc.encode('ai-platform-gateway/v1');

let cached: CryptoKey | null = null;
let cachedSecret = '';

export async function masterKey(secret: string): Promise<CryptoKey> {
  if (cached && cachedSecret === secret) return cached;
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  cached = key;
  cachedSecret = secret;
  return key;
}

function b64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let s = '';
  for (const b of view) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encrypt(secret: string, plaintext: string): Promise<string> {
  const key = await masterKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `${b64(iv.buffer)}.${b64(ct)}`;
}

export async function decrypt(secret: string, payload: string): Promise<string> {
  const [ivPart, ctPart] = payload.split('.');
  if (!ivPart || !ctPart) throw new Error('malformed ciphertext');
  const key = await masterKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivPart) },
    key,
    unb64(ctPart),
  );
  return dec.decode(plain);
}

/** Non-reversible display hint: shape + last four characters. */
export function keyHint(key: string): string {
  const trimmed = key.trim();
  const tail = trimmed.slice(-4);
  const head = trimmed.slice(0, Math.min(3, Math.max(0, trimmed.length - 4)));
  return `${head}…${tail}`;
}
