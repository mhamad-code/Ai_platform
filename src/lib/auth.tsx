import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  updatePassword,
  deleteUser,
  getIdToken,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { auth, db, firebaseConfigured, requireAuth, requireDb } from './firebase';
import { setGatewayTokenProvider } from './gateway';

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const MAP_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'auth.invalidCreds',
  'auth/wrong-password': 'auth.invalidCreds',
  'auth/user-not-found': 'auth.invalidCreds',
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/weak-password': 'auth.weakPassword',
  'auth/invalid-email': 'auth.invalidCreds',
  'auth/too-many-requests': 'chat.errorGeneric',
  'auth/network-request-failed': 'chat.errorNetwork',
  'auth/popup-closed-by-user': 'common.cancel',
};

export class AuthError extends Error {
  key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
  }
}

function mapError(e: unknown): never {
  const code = (e as { code?: string })?.code ?? '';
  const key = MAP_ERRORS[code];
  if (key) throw new AuthError(key);
  throw new AuthError('chat.errorGeneric');
}

function toUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    name: u.displayName,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      setGatewayTokenProvider(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(toUser(u));
      setLoading(false);
      // Attach the signed-in user's ID token to every gateway request.
      setGatewayTokenProvider(u ? () => getIdToken(u) : null);
      // Keep the profile document in sync with Auth.
      if (u && db) {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: u.uid,
            name: u.displayName ?? '',
            email: u.email ?? '',
            photoURL: u.photoURL ?? '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
    } catch (e) {
      mapError(e);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(requireDb(), 'users', cred.user.uid), {
        uid: cred.user.uid,
        name,
        email: email.trim(),
        photoURL: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      mapError(e);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(requireAuth(), provider);
    } catch (e) {
      mapError(e);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(requireAuth(), email.trim());
    } catch (e) {
      mapError(e);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(requireAuth());
  }, []);

  const updateName = useCallback(
    async (name: string) => {
      const u = requireAuth().currentUser;
      if (!u) return;
      await updateProfile(u, { displayName: name });
      await setDoc(
        doc(requireDb(), 'users', u.uid),
        { name, updatedAt: Date.now() },
        { merge: true },
      );
      setUser(toUser({ ...u, displayName: name }));
    },
    [],
  );

  const changePassword = useCallback(async (current: string, next: string) => {
    const u = requireAuth().currentUser;
    if (!u || !u.email) throw new AuthError('auth.invalidCreds');
    const cred = EmailAuthProvider.credential(u.email, current);
    try {
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, next);
    } catch (e) {
      mapError(e);
    }
  }, []);

  const deleteAccount = useCallback(async (currentPassword?: string) => {
    const u = requireAuth().currentUser;
    if (!u) return;
    if (!u.providerData.some((p) => p.providerId === 'password') && currentPassword) {
      // password not used for this account
    } else if (currentPassword && u.email) {
      const cred = EmailAuthProvider.credential(u.email, currentPassword);
      try {
        await reauthenticateWithCredential(u, cred);
      } catch (e) {
        mapError(e);
      }
    }
    const d = requireDb();
    // remove user-owned subcollections we know about
    for (const sub of ['chats', 'projects', 'files', 'folders', 'modelSettings', 'integrations', 'providerKeys', 'settings']) {
      const snap = await getDoc(doc(d, 'users', u.uid));
      void snap;
      try {
        await deleteDoc(doc(d, 'users', u.uid, sub, '_'));
      } catch {
        /* subcollection docs are deleted individually below */
      }
    }
    await deleteDoc(doc(d, 'users', u.uid)).catch(() => undefined);
    await deleteUser(u);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut,
      updateName,
      changePassword,
      deleteAccount,
    }),
    [user, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut, updateName, changePassword, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { Timestamp };
