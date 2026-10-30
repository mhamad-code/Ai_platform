/**
 * Gateway client — the ONLY network surface the UI uses for AI providers,
 * web search and integration connections. Vendor endpoints are never called
 * from components.
 *
 * Two modes, chosen at build time:
 *  - VITE_GATEWAY_URL set   → a server gateway holds the keys (server-side).
 *  - VITE_GATEWAY_URL empty → local mode: keys are stored encrypted on this
 *    device only and the browser calls the provider directly (see ./local).
 */
import { GatewayError } from './gatewayError';
import { localGateway, localStreamChat } from './local';

export { GatewayError };

const RAW_BASE = ((import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? '').trim().replace(/\/$/, '');
export const GATEWAY_BASE = RAW_BASE;
/** True when no server gateway is configured and everything runs on this device. */
export const localMode = !RAW_BASE;
/** True when a backend (remote gateway or the local engine) can serve AI calls. */
export const gatewayEnabled = true;

/**
 * Identity sent to the gateway. Two layers:
 *  - X-Client-Id: a stable, opaque browser id so credentials are at least
 *    isolated per browser when Firebase is not configured.
 *  - Authorization: the Firebase ID token when a user is signed in; the
 *    gateway verifies the signature and derives the Firestore uid from it.
 */
const CLIENT_KEY = 'aiplatform.client.id';

function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `c-${Math.random().toString(36).slice(2)}${Date.now()}`;
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

let tokenProvider: (() => Promise<string | null>) | null = null;

/** Wired by AuthProvider so requests carry the signed-in user's ID token. */
export function setGatewayTokenProvider(fn: (() => Promise<string | null>) | null) {
  tokenProvider = fn;
}

async function identityHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-Client-Id': clientId() };
  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* unauthenticated requests still work in local mode */
    }
  }
  return headers;
}

let healthCache: { at: number; ok: boolean } | null = null;

export async function gatewayHealth(timeoutMs = 3500): Promise<boolean> {
  if (localMode) return true;
  if (healthCache && Date.now() - healthCache.at < 15000) return healthCache.ok;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${GATEWAY_BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    healthCache = { at: Date.now(), ok: res.ok };
    return res.ok;
  } catch {
    healthCache = { at: Date.now(), ok: false };
    return false;
  }
}

export function resetHealthCache() {
  healthCache = null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(await identityHeaders()),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new GatewayError('network', (e as Error).message);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg =
      (body as { error?: string; message?: string })?.error ||
      (body as { message?: string })?.message ||
      `HTTP ${res.status}`;
    const kind =
      res.status === 401 || res.status === 403
        ? 'auth'
        : res.status === 429
          ? 'quota'
          : res.status >= 500
            ? 'server'
            : 'unknown';
    throw new GatewayError(kind, msg, res.status);
  }
  return body as T;
}

// ------------------------------ providers --------------------------------

export interface GatewayModel {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  [k: string]: unknown;
}

const remoteGateway = {
  providers: {
    status: () => request<{ connections: Record<string, { connected: boolean; hint?: string; models?: number; lastTest?: { ok: boolean; at: number; message?: string } }> }>('/providers'),
    saveKey: (provider: string, apiKey: string) =>
      request<{ ok: boolean; hint: string }>(`/providers/${provider}/key`, {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
    test: (provider: string) =>
      request<{ ok: boolean; message: string; models?: number }>('/providers/test', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      }),
    remove: (provider: string) => request<{ ok: boolean }>(`/providers/${provider}`, { method: 'DELETE' }),
    models: (provider: string) =>
      request<{ models: GatewayModel[] }>(`/providers/${provider}/models`),
    allModels: () => request<{ models: GatewayModel[] }>('/models'),
  },
  chat: {
    start: (payload: unknown) =>
      fetch(`${GATEWAY_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
  },
  images: {
    generate: (payload: unknown) =>
      request<{ images: { url?: string; b64?: string }[] }>('/images', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  search: {
    web: (payload: { query: string; mode?: 'fast' | 'deep' | 'images' | 'news' }) =>
      request<{ results: import('../ai/types').SourceItem[] }>('/search', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    images: (payload: { query: string; limit?: number }) =>
      request<{ results: import('../ai/types').SourceItem[] }>('/search/images', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  integrations: {
    status: () => request<{ connections: Record<string, { status: string; account?: string; scopes?: string[]; verified?: boolean }> }>('/integrations'),
    start: (service: string) =>
      request<{ url: string }>(`/integrations/${service}/connect`, { method: 'POST' }),
    saveToken: (service: string, token: string) =>
      request<{ ok: boolean; account?: string; verified?: boolean }>(`/integrations/${service}/token`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    disconnect: (service: string) => request<{ ok: boolean }>(`/integrations/${service}`, { method: 'DELETE' }),
    invoke: (service: string, tool: string, args: unknown) =>
      request<{ result: unknown }>(`/integrations/${service}/tools/${tool}`, {
        method: 'POST',
        body: JSON.stringify(args ?? {}),
      }),
  },
};

/** The active implementation: local engine, or the server gateway when one is configured. */
export const gateway: typeof remoteGateway = localMode ? localGateway : remoteGateway;

/**
 * Reads an SSE stream produced by POST /chat.
 * Events: {type:'text'|'source'|'reasoning'|'done'|'error', ...}
 */
export async function streamChat(
  payload: Record<string, unknown>,
  onEvent: (ev: import('../ai/types').StreamDelta) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (localMode) return localStreamChat(payload, onEvent, signal);
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await identityHeaders()) },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw new GatewayError('network', (e as Error).message);
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try {
      msg = JSON.parse(text)?.error ?? text;
    } catch {
      /* keep raw */
    }
    const kind = res.status === 401 ? 'auth' : res.status === 429 ? 'quota' : 'server';
    throw new GatewayError(kind, msg || `HTTP ${res.status}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n');
    buffer = chunks.pop() ?? '';
    for (const line of chunks) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payloadText = trimmed.slice(5).trim();
      if (!payloadText || payloadText === '[DONE]') continue;
      try {
        const ev = JSON.parse(payloadText) as import('../ai/types').StreamDelta;
        onEvent(ev);
        if (ev.type === 'done') return;
      } catch {
        /* partial frame */
      }
    }
  }
}
