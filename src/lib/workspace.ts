/**
 * Workspace facade — routes every read/write to one of two real backends:
 *
 *  - 'firestore' : Firebase is configured AND a user is signed in.
 *  - 'local'     : Firebase is not configured (setup pending). Data is kept in
 *                  this browser only and the UI shows a permanent "local only"
 *                  badge — it is never presented as synced cloud data.
 */
import type { AttachmentMeta, ChatMessage, ProviderConnection } from '../ai/types';
import {
  chatRepo,
  exportUserData,
  fileRepo,
  folderRepo,
  integrationRepo,
  messageRepo,
  modelSettingsRepo,
  projectRepo,
  providerRepo,
  settingsRepo,
  storageRepo,
  type ChatMeta,
  type FileDoc,
  type FolderDoc,
  type IntegrationDoc,
  type ModelParams,
  type ProjectDoc,
  type SettingsDoc,
} from './db';

type Listener = () => void;

interface LocalDB {
  chats: ChatMeta[];
  messages: Record<string, ChatMessage[]>;
  projects: ProjectDoc[];
  files: FileDoc[];
  folders: FolderDoc[];
  integrations: IntegrationDoc[];
  providerKeys: ProviderConnection[];
  modelSettings: ModelParams[];
  settings: SettingsDoc;
}

const EMPTY: LocalDB = {
  chats: [],
  messages: {},
  projects: [],
  files: [],
  folders: [],
  integrations: [],
  providerKeys: [],
  modelSettings: [],
  settings: {},
};

const LOCAL_KEY = 'aiplatform.workspace.v1';
const listeners = new Set<Listener>();
let localDb: LocalDB = loadLocal();

function loadLocal(): LocalDB {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

function commit() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localDb));
  } catch (e) {
    console.error('[workspace] local write failed', e);
  }
  listeners.forEach((l) => l());
}

export function subscribeLocal(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ------------------------------- workspace state --------------------------

let mode: 'firestore' | 'local' = 'local';
let currentUid = 'local';
let user: { uid: string } | null = null;

export function configureWorkspace(u: { uid: string } | null) {
  user = u;
  mode = u ? 'firestore' : 'local';
  currentUid = u?.uid ?? 'local';
}

export const workspace = {
  get mode() {
    return mode;
  },
  get uid() {
    return currentUid;
  },
  get signedIn() {
    return mode === 'firestore';
  },
  /** true when cloud sync is unavailable and everything stays in this browser */
  get localOnly() {
    return mode === 'local';
  },
};

function watch<T>(cb: (rows: T[]) => void, read: () => T[]): () => void {
  cb(read());
  return subscribeLocal(() => cb(read()));
}

// ---------------------------------- chats ---------------------------------

export const chats = {
  subscribe(cb: (rows: ChatMeta[]) => void, opts: { archived?: boolean } = {}) {
    if (mode === 'firestore') return chatRepo.subscribe(currentUid, cb, opts);
    const read = () =>
      localDb.chats.filter((c) => Boolean(c.archived) === Boolean(opts.archived)).sort((a, b) => b.updatedAt - a.updatedAt);
    return watch(cb, read);
  },
  async save(chat: ChatMeta) {
    if (mode === 'firestore') return chatRepo.save(currentUid, chat);
    const i = localDb.chats.findIndex((c) => c.id === chat.id);
    if (i >= 0) localDb.chats[i] = chat;
    else localDb.chats.push(chat);
    commit();
  },
  async patch(id: string, patch: Partial<ChatMeta>) {
    if (mode === 'firestore') return chatRepo.patch(currentUid, id, patch);
    const c = localDb.chats.find((x) => x.id === id);
    if (c) Object.assign(c, patch, { updatedAt: Date.now() });
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return chatRepo.remove(currentUid, id);
    localDb.chats = localDb.chats.filter((c) => c.id !== id);
    delete localDb.messages[id];
    commit();
  },
};

export const messages = {
  subscribe(chatId: string, cb: (rows: ChatMessage[]) => void) {
    if (mode === 'firestore') return messageRepo.subscribe(currentUid, chatId, cb);
    return watch(cb, () => (localDb.messages[chatId] ?? []).slice().sort((a, b) => a.createdAt - b.createdAt));
  },
  async save(chatId: string, msg: ChatMessage) {
    if (mode === 'firestore') return messageRepo.save(currentUid, chatId, msg);
    const arr = (localDb.messages[chatId] ??= []);
    const i = arr.findIndex((m) => m.id === msg.id);
    if (i >= 0) arr[i] = msg;
    else arr.push(msg);
    commit();
  },
  async clear(chatId: string) {
    if (mode === 'firestore') return messageRepo.clear(currentUid, chatId);
    localDb.messages[chatId] = [];
    commit();
  },
};

export const projects = {
  subscribe(cb: (rows: ProjectDoc[]) => void) {
    if (mode === 'firestore') return projectRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt));
  },
  async save(p: ProjectDoc) {
    if (mode === 'firestore') return projectRepo.save(currentUid, p);
    const i = localDb.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) localDb.projects[i] = p;
    else localDb.projects.push(p);
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return projectRepo.remove(currentUid, id);
    localDb.projects = localDb.projects.filter((p) => p.id !== id);
    commit();
  },
};

export const folders = {
  subscribe(cb: (rows: FolderDoc[]) => void) {
    if (mode === 'firestore') return folderRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.folders.slice().sort((a, b) => a.createdAt - b.createdAt));
  },
  async save(f: FolderDoc) {
    if (mode === 'firestore') return folderRepo.save(currentUid, f);
    const i = localDb.folders.findIndex((x) => x.id === f.id);
    if (i >= 0) localDb.folders[i] = f;
    else localDb.folders.push(f);
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return folderRepo.remove(currentUid, id);
    localDb.folders = localDb.folders.filter((f) => f.id !== id);
    commit();
  },
};

export const files = {
  subscribe(cb: (rows: FileDoc[]) => void) {
    if (mode === 'firestore') return fileRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.files.slice().sort((a, b) => b.createdAt - a.createdAt));
  },
  async save(f: FileDoc) {
    if (mode === 'firestore') return fileRepo.save(currentUid, f);
    const i = localDb.files.findIndex((x) => x.id === f.id);
    if (i >= 0) localDb.files[i] = f;
    else localDb.files.push(f);
    commit();
  },
  async rename(id: string, name: string) {
    if (mode === 'firestore') return fileRepo.rename(currentUid, id, name);
    const f = localDb.files.find((x) => x.id === id);
    if (f) f.name = name;
    commit();
  },
  async move(id: string, folderId: string | null) {
    if (mode === 'firestore') return fileRepo.move(currentUid, id, folderId);
    const f = localDb.files.find((x) => x.id === id);
    if (f) f.folderId = folderId;
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return fileRepo.remove(currentUid, id);
    localDb.files = localDb.files.filter((f) => f.id !== id);
    commit();
  },
};

export const integrations = {
  subscribe(cb: (rows: IntegrationDoc[]) => void) {
    if (mode === 'firestore') return integrationRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.integrations.slice());
  },
  async save(id: string, data: Omit<IntegrationDoc, 'id'>) {
    if (mode === 'firestore') return integrationRepo.save(currentUid, id, data);
    const i = localDb.integrations.findIndex((x) => x.id === id);
    if (i >= 0) localDb.integrations[i] = { id, ...data };
    else localDb.integrations.push({ id, ...data });
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return integrationRepo.remove(currentUid, id);
    localDb.integrations = localDb.integrations.filter((x) => x.id !== id);
    commit();
  },
};

export const providerKeys = {
  subscribe(cb: (rows: ProviderConnection[]) => void) {
    if (mode === 'firestore') return providerRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.providerKeys.slice());
  },
  async save(id: string, data: Partial<ProviderConnection>) {
    if (mode === 'firestore') return providerRepo.save(currentUid, id, data);
    const i = localDb.providerKeys.findIndex((x) => x.provider === id);
    if (i >= 0) localDb.providerKeys[i] = { ...(localDb.providerKeys[i] as ProviderConnection), ...data, provider: id as ProviderConnection['provider'] };
    else localDb.providerKeys.push({ provider: id as ProviderConnection['provider'], connected: true, ...data });
    commit();
  },
  async remove(id: string) {
    if (mode === 'firestore') return providerRepo.remove(currentUid, id);
    localDb.providerKeys = localDb.providerKeys.filter((x) => x.provider !== id);
    commit();
  },
};

export const modelParams = {
  subscribe(cb: (rows: ModelParams[]) => void) {
    if (mode === 'firestore') return modelSettingsRepo.subscribe(currentUid, cb);
    return watch(cb, () => localDb.modelSettings.slice());
  },
  async save(modelId: string, data: Omit<ModelParams, 'modelId'>) {
    if (mode === 'firestore') return modelSettingsRepo.save(currentUid, modelId, data);
    const i = localDb.modelSettings.findIndex((m) => m.modelId === modelId);
    if (i >= 0) localDb.modelSettings[i] = { modelId, ...data };
    else localDb.modelSettings.push({ modelId, ...data });
    commit();
  },
  async remove(modelId: string) {
    if (mode === 'firestore') return modelSettingsRepo.remove(currentUid, modelId);
    localDb.modelSettings = localDb.modelSettings.filter((m) => m.modelId !== modelId);
    commit();
  },
};

export const userSettings = {
  async get(): Promise<SettingsDoc | null> {
    if (mode === 'firestore') return settingsRepo.get(currentUid);
    return localDb.settings;
  },
  subscribe(cb: (s: SettingsDoc) => void) {
    if (mode === 'firestore') return settingsRepo.subscribe(currentUid, cb);
    return watch<SettingsDoc>((rows) => cb(rows[0] ?? {}), () => [localDb.settings]);
  },
  async save(data: SettingsDoc) {
    if (mode === 'firestore') return settingsRepo.save(currentUid, data);
    localDb.settings = { ...localDb.settings, ...data, updatedAt: Date.now() };
    commit();
  },
};

export const uploads = {
  async add(file: File): Promise<{ path: string; url: string }> {
    if (mode === 'firestore') return storageRepo.upload(currentUid, file);
    // local mode: hold the object URL in memory for this session only
    const url = URL.createObjectURL(file);
    return { path: `local/${Date.now()}-${file.name}`, url };
  },
  async remove(path: string) {
    if (mode === 'firestore') return storageRepo.remove(path);
    if (path.startsWith('blob:')) URL.revokeObjectURL(path);
  },
};

export async function exportAll() {
  if (mode === 'firestore') return exportUserData(currentUid);
  return {
    exportedAt: new Date().toISOString(),
    profile: { uid: currentUid },
    chats: localDb.chats.map((c) => ({ ...c, messages: localDb.messages[c.id] ?? [] })),
    projects: localDb.projects,
    files: localDb.files,
    folders: localDb.folders,
    settings: localDb.settings,
    providers: localDb.providerKeys,
    integrations: localDb.integrations,
    modelSettings: localDb.modelSettings,
  };
}

export function clearHistory() {
  if (mode === 'firestore') return chatRepo.wipe(currentUid);
  localDb.chats = [];
  localDb.messages = {};
  commit();
}

export type { AttachmentMeta, ChatMeta, FileDoc, FolderDoc, ProjectDoc, SettingsDoc, IntegrationDoc, ModelParams };
