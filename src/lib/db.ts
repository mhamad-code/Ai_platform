/**
 * Firebase Data Layer.
 * Every read/write is scoped to the signed-in uid; nothing is keyed off
 * client-supplied ids. Collections live under users/{uid}/… so Security Rules
 * can be as simple as `allow read, write: if request.auth != null &&
 * request.auth.uid == userId`.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, firebaseConfigured, requireDb, requireStorage } from './firebase';
import type { AttachmentMeta, ChatMessage, ProviderConnection, SourceItem } from '../ai/types';

export const dataAvailable = firebaseConfigured;

function fail(): never {
  throw new Error('FIREBASE_NOT_CONFIGURED');
}

export interface ChatMeta {
  id: string;
  title: string;
  model: string;
  provider?: string;
  projectId?: string | null;
  category?: string;
  pinned?: boolean;
  archived?: boolean;
  temporary?: boolean;
  webSearch?: boolean;
  preview?: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface ProjectDoc {
  id: string;
  name: string;
  description: string;
  instructions: string;
  fileIds: string[];
  modelIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FileDoc {
  id: string;
  name: string;
  folderId: string | null;
  size: number;
  mime: string;
  kind: AttachmentMeta['kind'];
  path: string;
  url: string;
  createdAt: number;
}

export interface FolderDoc {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface IntegrationDoc {
  id: string;
  status: 'connected' | 'error' | 'pending';
  account?: string;
  scopes?: string[];
  verified?: boolean;
  updatedAt: number;
  provider?: string;
}

export interface SettingsDoc {
  theme?: 'dark' | 'light';
  lang?: 'ar' | 'en';
  accent?: string;
  fontSize?: number;
  density?: 'comfy' | 'compact';
  motion?: boolean;
  background?: 'ridge' | 'cliff' | 'mist';
  backgroundAnim?: boolean;
  defaultModel?: string;
  enterToSend?: boolean;
  markdown?: boolean;
  webSearchDefault?: boolean;
  retention?: 'temp' | 'keep';
  updatedAt?: number;
}

// ------------------------------- helpers ---------------------------------

async function assertDb() {
  if (!firebaseConfigured) fail();
  return requireDb();
}

async function list<T>(uid: string, sub: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const d = await assertDb();
  const q = query(collection(d, 'users', uid, sub), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((x) => ({ id: x.id, ...x.data() }) as T);
}

function subscribe<T>(
  uid: string,
  sub: string,
  cb: (rows: T[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  if (!firebaseConfigured || !db) return () => undefined;
  const q = query(collection(db, 'users', uid, sub), ...constraints);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as T)),
    (err) => console.error(`[firestore:${sub}]`, err),
  );
}

async function upsert(uid: string, sub: string, id: string, data: Record<string, unknown>) {
  const d = await assertDb();
  await setDoc(doc(d, 'users', uid, sub, id), { ...data, updatedAt: Date.now() }, { merge: true });
}

async function remove(uid: string, sub: string, id: string) {
  const d = await assertDb();
  await deleteDoc(doc(d, 'users', uid, sub, id));
}

// --------------------------------- chats ----------------------------------

export const chatRepo = {
  list: (uid: string, opts: { archived?: boolean } = {}) =>
    list<ChatMeta>(uid, 'chats', orderBy('updatedAt', 'desc')).then((rows) =>
      rows.filter((c) => Boolean(c.archived) === Boolean(opts.archived)),
    ),
  subscribe: (uid: string, cb: (rows: ChatMeta[]) => void, opts: { archived?: boolean } = {}) =>
    subscribe<ChatMeta>(uid, 'chats', (rows) => cb(rows.filter((c) => Boolean(c.archived) === Boolean(opts.archived))), orderBy('updatedAt', 'desc')),
  save: (uid: string, chat: ChatMeta) => upsert(uid, 'chats', chat.id, chat as unknown as Record<string, unknown>),
  patch: async (uid: string, id: string, patch: Partial<ChatMeta>) => {
    const d = await assertDb();
    await updateDoc(doc(d, 'users', uid, 'chats', id), { ...patch, updatedAt: Date.now() });
  },
  remove: (uid: string, id: string) => remove(uid, 'chats', id),
  duplicate: async (uid: string, id: string) => {
    const d = await assertDb();
    const snap = await getDoc(doc(d, 'users', uid, 'chats', id));
    if (!snap.exists()) return null;
    const newId = doc(collection(d, 'users', uid, 'chats')).id;
    const data = snap.data() as ChatMeta;
    await setDoc(doc(d, 'users', uid, 'chats', newId), {
      ...data,
      id: newId,
      title: `${data.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return newId;
  },
  wipe: async (uid: string) => {
    const rows = await chatRepo.list(uid, { archived: true });
    const normal = await chatRepo.list(uid);
    for (const c of [...rows, ...normal]) await chatRepo.remove(uid, c.id);
  },
};

export const messageRepo = {
  subscribe: (uid: string, chatId: string, cb: (rows: ChatMessage[]) => void) =>
    subscribe<ChatMessage>(uid, `chats/${chatId}/messages`, cb, orderBy('createdAt', 'asc')),
  save: (uid: string, chatId: string, msg: ChatMessage) =>
    upsert(uid, `chats/${chatId}/messages`, msg.id, msg as unknown as Record<string, unknown>),
  remove: (uid: string, chatId: string, msgId: string) => remove(uid, `chats/${chatId}/messages`, msgId),
  clear: async (uid: string, chatId: string) => {
    const rows = await messageRepo.list(uid, chatId);
    for (const m of rows) await messageRepo.remove(uid, chatId, m.id);
  },
  list: (uid: string, chatId: string) =>
    list<ChatMessage>(uid, `chats/${chatId}/messages`, orderBy('createdAt', 'asc')),
};

// ------------------------------- projects --------------------------------

export const projectRepo = {
  list: (uid: string) => list<ProjectDoc>(uid, 'projects', orderBy('updatedAt', 'desc')),
  subscribe: (uid: string, cb: (rows: ProjectDoc[]) => void) =>
    subscribe<ProjectDoc>(uid, 'projects', cb, orderBy('updatedAt', 'desc')),
  save: (uid: string, p: ProjectDoc) => upsert(uid, 'projects', p.id, p as unknown as Record<string, unknown>),
  remove: (uid: string, id: string) => remove(uid, 'projects', id),
};

// -------------------------------- files ----------------------------------

export const fileRepo = {
  list: (uid: string) => list<FileDoc>(uid, 'files', orderBy('createdAt', 'desc')),
  subscribe: (uid: string, cb: (rows: FileDoc[]) => void) =>
    subscribe<FileDoc>(uid, 'files', cb, orderBy('createdAt', 'desc')),
  save: (uid: string, f: FileDoc) => upsert(uid, 'files', f.id, f as unknown as Record<string, unknown>),
  remove: (uid: string, id: string) => remove(uid, 'files', id),
  rename: async (uid: string, id: string, name: string) => {
    const d = await assertDb();
    await updateDoc(doc(d, 'users', uid, 'files', id), { name, updatedAt: Date.now() });
  },
  move: async (uid: string, id: string, folderId: string | null) => {
    const d = await assertDb();
    await updateDoc(doc(d, 'users', uid, 'files', id), { folderId, updatedAt: Date.now() });
  },
};

export const folderRepo = {
  list: (uid: string) => list<FolderDoc>(uid, 'folders', orderBy('createdAt', 'asc')),
  subscribe: (uid: string, cb: (rows: FolderDoc[]) => void) =>
    subscribe<FolderDoc>(uid, 'folders', cb, orderBy('createdAt', 'asc')),
  save: (uid: string, f: FolderDoc) => upsert(uid, 'folders', f.id, f as unknown as Record<string, unknown>),
  remove: (uid: string, id: string) => remove(uid, 'folders', id),
};

// ------------------------------ integrations -----------------------------

export const integrationRepo = {
  list: (uid: string) => list<IntegrationDoc>(uid, 'integrations'),
  subscribe: (uid: string, cb: (rows: IntegrationDoc[]) => void) =>
    subscribe<IntegrationDoc>(uid, 'integrations', cb),
  save: (uid: string, id: string, data: Omit<IntegrationDoc, 'id'>) => upsert(uid, 'integrations', id, data),
  remove: (uid: string, id: string) => remove(uid, 'integrations', id),
};

// ---------------------------- provider keys ------------------------------

export const providerRepo = {
  list: (uid: string) => list<ProviderConnection>(uid, 'providerKeys'),
  subscribe: (uid: string, cb: (rows: ProviderConnection[]) => void) =>
    subscribe<ProviderConnection>(uid, 'providerKeys', cb),
  save: (uid: string, id: string, data: Partial<ProviderConnection>) =>
    upsert(uid, 'providerKeys', id, data as Record<string, unknown>),
  remove: (uid: string, id: string) => remove(uid, 'providerKeys', id),
};

// --------------------------- model settings ------------------------------

export interface ModelParams {
  modelId: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  seed?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  responseFormat?: 'text' | 'json';
  system?: string;
}

export const modelSettingsRepo = {
  list: (uid: string) => list<ModelParams>(uid, 'modelSettings'),
  subscribe: (uid: string, cb: (rows: ModelParams[]) => void) => subscribe<ModelParams>(uid, 'modelSettings', cb),
  save: (uid: string, modelId: string, data: Omit<ModelParams, 'modelId'>) =>
    upsert(uid, 'modelSettings', modelId, data as Record<string, unknown>),
  remove: (uid: string, modelId: string) => remove(uid, 'modelSettings', modelId),
};

// ------------------------------- settings --------------------------------

export const settingsRepo = {
  async get(uid: string): Promise<SettingsDoc | null> {
    if (!firebaseConfigured || !db) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'app'));
    return snap.exists() ? (snap.data() as SettingsDoc) : null;
  },
  subscribe(uid: string, cb: (s: SettingsDoc) => void) {
    if (!firebaseConfigured || !db) return () => undefined;
    return onSnapshot(doc(db, 'users', uid, 'settings', 'app'), (snap) => {
      if (snap.exists()) cb(snap.data() as SettingsDoc);
    });
  },
  save: (uid: string, data: SettingsDoc) => upsert(uid, 'settings', 'app', data as Record<string, unknown>),
};

// ------------------------------- storage ---------------------------------

export const storageRepo = {
  async upload(uid: string, file: File, folder = 'files') {
    if (!firebaseConfigured) fail();
    const path = `users/${uid}/${folder}/${Date.now()}-${file.name.replace(/[^\w.\-؀-ۿ]/g, '_')}`;
    const r = ref(requireStorage(), path);
    const snap = await uploadBytes(r, file, { contentType: file.type });
    const url = await getDownloadURL(snap.ref);
    return { path: snap.ref.fullPath, url };
  },
  async remove(path: string) {
    if (!firebaseConfigured) fail();
    await deleteObject(ref(requireStorage(), path)).catch(() => undefined);
  },
};

// ------------------------------ export data ------------------------------

export async function exportUserData(uid: string) {
  const [chats, projects, files, folders, settings, providers, integrations, modelSettings] =
    await Promise.all([
      chatRepo.list(uid, { archived: true }).catch(() => []),
      chatRepo.list(uid).catch(() => []),
      projectRepo.list(uid).catch(() => []),
      fileRepo.list(uid).catch(() => []),
      folderRepo.list(uid).catch(() => []),
      settingsRepo.get(uid),
      providerRepo.list(uid).catch(() => []),
      integrationRepo.list(uid).catch(() => []),
      modelSettingsRepo.list(uid).catch(() => []),
    ]);
  const allChats = [...chats, ...projects];
  const withMessages = await Promise.all(
    allChats.map(async (c) => ({ ...c, messages: await messageRepo.list(uid, c.id).catch(() => []) })),
  );
  return {
    exportedAt: new Date().toISOString(),
    profile: { uid },
    chats: withMessages,
    projects: projects,
    files,
    folders,
    settings,
    providers,
    integrations,
    modelSettings,
  };
}

export type { SourceItem };
