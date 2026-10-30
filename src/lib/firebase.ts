/**
 * Firebase bootstrap.
 *
 * The web config below is a PUBLIC identifier (it is shipped to every
 * browser). Security comes from Firestore/Storage Security Rules and App
 * Check, never from hiding this config. Admin credentials, provider API keys
 * and OAuth client secrets must never appear in this bundle — they live in
 * the server gateway (see /server).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env as Record<string, string | undefined>;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

export const googleClientId = env.VITE_FIREBASE_GOOGLE_CLIENT_ID ?? '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseConfigured) {
  try {
    app = initializeApp(config as Record<string, string>);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.error('[firebase] init failed', err);
    app = null;
  }
}

export function requireAuth(): Auth {
  if (!auth) throw new Error('FIREBASE_NOT_CONFIGURED');
  return auth;
}
export function requireDb(): Firestore {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  return db;
}
export function requireStorage(): FirebaseStorage {
  if (!storage) throw new Error('FIREBASE_NOT_CONFIGURED');
  return storage;
}
export { auth, db, storage };
