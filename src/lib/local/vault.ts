/**
 * Encrypted on-device key vault (used when no server gateway is configured).
 *
 *  - A random AES-256-GCM key is generated once and kept in IndexedDB as a
 *    NON-EXTRACTABLE CryptoKey: scripts can use it, but its raw bytes can never
 *    be read, exported, or copied out with the data.
 *  - Provider API keys are stored in localStorage only as AES-GCM ciphertext
 *    (fresh random IV per write, provider id bound as additional data).
 *  - Plaintext exists only in memory for the duration of a single request.
 *
 * Honest limits: this protects keys at rest (storage dumps, backups, copied
 * profile files, casual inspection). Code running inside this page could still
 * ask the vault to decrypt, so keep the app free of third-party scripts.
 */

const DB_NAME = 'aiplatform-vault';
const STORE = 'keys';
const MASTER_ID = 'master-v1';
const LS_KEYS = 'aiplatform.vault.v1';
const LS_TESTS = 'aiplatform.vault.tests.v1';

interface StoredKey {
  ct: string;
  hint: string;
  at: number;
}
export interface StoredTest {
  ok: boolean;
  at: number;
  message: string;
  models: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of view) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(value: string): ArrayBuffer {
  const bin = atob(value);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let masterPromise: Promise<CryptoKey> | null = null;

function masterKey(): Promise<CryptoKey> {
  if (!masterPromise) {
    masterPromise = (async () => {
      if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is not available (HTTPS is required)');
      const db = await openDb();
      let key = await idbGet(db, MASTER_ID);
      if (!key) {
        key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await idbPut(db, MASTER_ID, key);
        // best effort: ask the browser not to evict our storage under pressure
        void navigator.storage?.persist?.().catch(() => undefined);
      }
      db.close();
      return key;
    })().catch((e) => {
      masterPromise = null;
      throw e;
    });
  }
  return masterPromise;
}

async function encrypt(provider: string, plaintext: string): Promise<string> {
  const key = await masterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(provider) },
    key,
    enc.encode(plaintext),
  );
  return `${b64(iv)}.${b64(ct)}`;
}

async function decrypt(provider: string, payload: string): Promise<string> {
  const [ivPart, ctPart] = payload.split('.');
  if (!ivPart || !ctPart) throw new Error('malformed ciphertext');
  const key = await masterKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivPart), additionalData: enc.encode(provider) },
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

function readMap<T>(name: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(name);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeMap<T>(name: string, value: Record<string, T>) {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch {
    throw new Error('Could not write to browser storage (is it full or blocked?)');
  }
}

export const vault = {
  async save(provider: string, apiKey: string): Promise<string> {
    const key = apiKey.trim();
    const entry: StoredKey = { ct: await encrypt(provider, key), hint: keyHint(key), at: Date.now() };
    const all = readMap<StoredKey>(LS_KEYS);
    all[provider] = entry;
    writeMap(LS_KEYS, all);
    return entry.hint;
  },

  /** Decrypts one provider key. Returns null when none is stored or it cannot be decrypted. */
  async get(provider: string): Promise<string | null> {
    const entry = readMap<StoredKey>(LS_KEYS)[provider];
    if (!entry) return null;
    try {
      return await decrypt(provider, entry.ct);
    } catch {
      return null;
    }
  },

  has(provider: string): boolean {
    return Boolean(readMap<StoredKey>(LS_KEYS)[provider]);
  },

  list(): Array<{ provider: string; hint: string }> {
    return Object.entries(readMap<StoredKey>(LS_KEYS)).map(([provider, v]) => ({ provider, hint: v.hint }));
  },

  remove(provider: string) {
    const keys = readMap<StoredKey>(LS_KEYS);
    delete keys[provider];
    writeMap(LS_KEYS, keys);
    const tests = readMap<StoredTest>(LS_TESTS);
    delete tests[provider];
    writeMap(LS_TESTS, tests);
  },

  tests(): Record<string, StoredTest> {
    return readMap<StoredTest>(LS_TESTS);
  },

  saveTest(provider: string, test: StoredTest) {
    const tests = readMap<StoredTest>(LS_TESTS);
    tests[provider] = test;
    writeMap(LS_TESTS, tests);
  },
};
