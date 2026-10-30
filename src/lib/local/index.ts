/**
 * Local engine — the no-server implementation of the gateway API.
 *
 * Used automatically when VITE_GATEWAY_URL is empty. Provider API keys are kept
 * encrypted on this device (see ./vault.ts) and the browser talks to the
 * provider directly. Features that genuinely need a server (OAuth / service
 * integrations) report that clearly instead of pretending to work.
 */
import { GatewayError } from '../gatewayError';
import type { GatewayModel } from '../gateway';
import type { SourceItem, StreamDelta } from '../../ai/types';
import {
  PROVIDER_DEFS,
  ProviderError,
  generateImages,
  listModels,
  providerChat,
  testProvider,
  type ChatParams,
  type WireMessage,
} from './providers';
import { deepResearch, searchImages, searchWeb } from './search';
import { vault } from './vault';

const isEn = () => document.documentElement.lang === 'en';

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed/i;

function corsMessage(provider: string): string {
  const label = PROVIDER_DEFS[provider]?.label ?? provider;
  return isEn()
    ? `Could not reach ${label} directly from the browser. The provider may block browser requests (CORS), or you are offline. Try OpenRouter, or run a server gateway.`
    : `تعذّر الاتصال بـ ${label} مباشرة من المتصفح. غالباً المزوّد يمنع الطلبات من المتصفح (CORS) أو لا يوجد إنترنت. جرّب OpenRouter أو شغّل بوابة خادم.`;
}

function toGatewayError(provider: string, e: unknown): GatewayError {
  if (e instanceof GatewayError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof TypeError || NETWORK_RE.test(msg)) return new GatewayError('network', corsMessage(provider));
  if (e instanceof ProviderError) {
    const kind = e.status === 401 || e.status === 403 ? 'auth' : e.status === 429 ? 'quota' : e.status >= 500 ? 'server' : 'unknown';
    return new GatewayError(kind, e.message, e.status);
  }
  return new GatewayError('unknown', msg);
}

function requireProvider(provider: string) {
  if (!PROVIDER_DEFS[provider]) throw new GatewayError('unknown', `unknown provider "${provider}"`, 400);
}

async function requireKey(provider: string): Promise<string> {
  const key = await vault.get(provider);
  if (!key) {
    throw new GatewayError(
      'auth',
      isEn() ? `No key stored on this device for "${provider}"` : `لا يوجد مفتاح محفوظ على هذا الجهاز لـ "${provider}"`,
      401,
    );
  }
  return key;
}

function needsServer(): GatewayError {
  return new GatewayError(
    'notConfigured',
    isEn()
      ? 'Service integrations need a server gateway (OAuth secrets cannot live in a browser).'
      : 'تكاملات الخدمات تحتاج بوابة خادم (أسرار OAuth لا يمكن حفظها في المتصفح).',
  );
}

async function modelsFor(provider?: string): Promise<{ models: GatewayModel[]; errors: Array<{ provider: string; message: string }> }> {
  const ids = provider ? (vault.has(provider) ? [provider] : []) : vault.list().map((r) => r.provider);
  const errors: Array<{ provider: string; message: string }> = [];
  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const key = await requireKey(id);
      const list = await listModels(id, key);
      return list.map((m) => ({ ...m, provider: id }) as GatewayModel);
    }),
  );
  const models: GatewayModel[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') models.push(...r.value);
    else errors.push({ provider: ids[i], message: toGatewayError(ids[i], r.reason).message });
  });
  return { models, errors };
}

export const localGateway = {
  providers: {
    status: async () => {
      const connections: Record<
        string,
        { connected: boolean; hint?: string; models?: number; lastTest?: { ok: boolean; at: number; message?: string } }
      > = {};
      for (const s of vault.list()) connections[s.provider] = { connected: true, hint: s.hint };
      for (const [provider, t] of Object.entries(vault.tests())) {
        if (!connections[provider]) continue; // test row without a key is stale
        connections[provider] = {
          ...connections[provider],
          connected: t.ok,
          lastTest: { ok: t.ok, at: t.at, message: t.message },
          models: t.models,
        };
      }
      return { connections };
    },

    saveKey: async (provider: string, apiKey: string) => {
      requireProvider(provider);
      if (!apiKey.trim()) throw new GatewayError('unknown', 'apiKey is required', 400);
      try {
        return { ok: true, hint: await vault.save(provider, apiKey) };
      } catch (e) {
        throw new GatewayError('unknown', (e as Error).message);
      }
    },

    test: async (provider: string) => {
      requireProvider(provider);
      let result = { ok: false, message: 'no credential', models: 0 };
      try {
        const key = await requireKey(provider);
        result = await testProvider(provider, key);
        if (!result.ok && NETWORK_RE.test(result.message)) result = { ...result, message: corsMessage(provider) };
      } catch (e) {
        result = { ok: false, message: toGatewayError(provider, e).message, models: 0 };
      }
      vault.saveTest(provider, { ok: result.ok, at: Date.now(), message: result.message, models: result.models });
      return result;
    },

    remove: async (provider: string) => {
      vault.remove(provider);
      return { ok: true };
    },

    models: async (provider: string) => {
      requireProvider(provider);
      const { models } = await modelsFor(provider);
      return { models };
    },

    allModels: async () => {
      const { models } = await modelsFor();
      return { models };
    },
  },

  chat: {
    start: async (_payload: unknown): Promise<Response> => {
      throw new GatewayError('unknown', 'use streamChat in local mode');
    },
  },

  images: {
    generate: async (payload: unknown) => {
      const body = payload as {
        provider?: string;
        model?: string;
        prompt?: string;
        size?: string;
        quality?: string;
        n?: number;
        image?: string;
      };
      const provider = body.provider ?? '';
      requireProvider(provider);
      if (!body.prompt) throw new GatewayError('unknown', 'prompt is required', 400);
      try {
        const apiKey = await requireKey(provider);
        const images = await generateImages({
          provider,
          apiKey,
          model: body.model ?? 'gpt-image-1',
          prompt: body.prompt,
          size: body.size,
          quality: body.quality,
          n: body.n,
          image: body.image,
        });
        return { images: images as { url?: string; b64?: string }[] };
      } catch (e) {
        throw toGatewayError(provider, e);
      }
    },
  },

  search: {
    web: async (payload: { query: string; mode?: 'fast' | 'deep' | 'images' | 'news' }) => {
      const mode = payload.mode === 'images' ? 'fast' : (payload.mode ?? 'fast');
      try {
        const results = mode === 'deep' ? await deepResearch(payload.query) : await searchWeb(payload.query, mode);
        return { results: results as SourceItem[] };
      } catch {
        return { results: [] as SourceItem[] };
      }
    },
    images: async (payload: { query: string; limit?: number }) => {
      try {
        return { results: (await searchImages(payload.query, payload.limit ?? 8)) as unknown as SourceItem[] };
      } catch {
        return { results: [] as SourceItem[] };
      }
    },
  },

  integrations: {
    status: async () => ({ connections: {} as Record<string, { status: string; account?: string; scopes?: string[]; verified?: boolean }> }),
    start: async (_service: string): Promise<{ url: string }> => {
      throw needsServer();
    },
    saveToken: async (_service: string, _token: string): Promise<{ ok: boolean; account?: string; verified?: boolean }> => {
      throw needsServer();
    },
    disconnect: async (_service: string) => ({ ok: true }),
    invoke: async (_service: string, _tool: string, _args: unknown): Promise<{ result: unknown }> => {
      throw needsServer();
    },
  },
};

/** Same contract as the server-backed streamChat, but the browser calls the provider itself. */
export async function localStreamChat(
  payload: Record<string, unknown>,
  onEvent: (ev: StreamDelta) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body = payload as {
    provider?: string;
    model?: string;
    messages?: WireMessage[];
    system?: string;
    params?: ChatParams;
    webSearch?: boolean;
    research?: boolean;
    reasoning?: 'fast' | 'balanced' | 'advanced';
  };

  const provider = body.provider ?? '';
  requireProvider(provider);
  if (!body.model) throw new GatewayError('unknown', 'model is required', 400);
  if (!body.messages?.length) throw new GatewayError('unknown', 'messages is required', 400);

  const apiKey = await requireKey(provider);

  /* web search / deep research → sources first, then the prompt */
  const collected: SourceItem[] = [];
  const userText = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (body.webSearch && userText.trim()) {
    try {
      const results = body.research ? await deepResearch(userText) : await searchWeb(userText, 'fast');
      collected.push(...results);
    } catch {
      /* search failure must not break the answer */
    }
  }

  let system = body.system ?? '';
  if (collected.length) {
    const block = [
      '## Live web results (verbatim — do not invent others)',
      ...collected.map(
        (r, i) => `${i + 1}. ${r.title} — ${r.url}${r.publishedAt ? ` (${r.publishedAt})` : ''}\n   ${r.snippet ?? ''}`,
      ),
      'Cite sources with Markdown links using exactly these URLs.',
    ].join('\n');
    system = `${system}\n\n${block}`;
  } else if (body.webSearch) {
    system = `${system}\n\nWeb search returned no results for this query. Say so plainly and do not invent links.`;
  }

  let stream: ReadableStream<string>;
  try {
    stream = await providerChat({
      provider,
      apiKey,
      model: body.model,
      messages: body.messages,
      system,
      params: body.params,
      reasoning: body.reasoning,
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw toGatewayError(provider, e);
  }

  for (const s of collected) onEvent({ type: 'source', source: s });

  const reader = stream.getReader();
  let buffer = '';
  const flush = (text: string): boolean => {
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data) as StreamDelta;
        onEvent(ev);
        if (ev.type === 'done') return true;
      } catch {
        /* partial frame */
      }
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const cut = buffer.lastIndexOf('\n');
      if (cut === -1) continue;
      const complete = buffer.slice(0, cut + 1);
      buffer = buffer.slice(cut + 1);
      if (flush(complete)) return;
    }
    if (buffer) flush(buffer);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw toGatewayError(provider, e);
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}
