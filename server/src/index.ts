/**
 * Gateway HTTP layer (Hono → Cloudflare Worker + D1).
 *
 * Responsibilities
 *  - resolve the calling client (verified Firebase ID token when configured)
 *  - store/retrieve encrypted provider credentials and integration tokens
 *  - stream chat, run image generation, run web/image search
 *  - drive OAuth flows and the tool registry
 *
 * No vendor key, OAuth secret or plaintext token is ever returned to a client.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { decrypt, encrypt, keyHint } from './crypto';
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
import { configureSearch, deepResearch, searchImages, searchWeb } from './search';
import {
  OAUTH_SERVICES,
  beginOAuth,
  finishOAuth,
  readToken,
  runTool,
  saveConnection,
  toolsFor,
  validateToken,
  type Env,
} from './integrations';

type Vars = { client: string; verified: boolean };

const app = new Hono<{ Bindings: { DB: D1Database } & Record<string, string>; Variables: Vars }>();

app.use('*', async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN ?? '*';
  return cors({ origin, allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Id'], exposeHeaders: ['Content-Type'] })(c, next);
});

/* ------------------------------ identity -------------------------------- */

/* The calling identity comes from a verified Firebase ID token when
 * FIREBASE_PROJECT_ID is configured, otherwise from an opaque browser id
 * (clearly weaker — the UI labels that mode as unverified). */
async function identity(req: Request, env: Env): Promise<{ client: string; verified: boolean }> {
  const header = req.headers.get('Authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const project = env.FIREBASE_PROJECT_ID;

  if (bearer && project) {
    const parts = bearer.split('.');
    if (parts.length === 3) {
      const [h, p, s] = parts;
      try {
        const head = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/'))) as { alg?: string; kid?: string };
        if (head.alg === 'RS256') {
          const jwks = (await (
            await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
          ).json()) as { keys?: Array<{ kid: string; n: string; e: string }> };
          const jwk = (jwks.keys ?? []).find((k) => k.kid === head.kid) ?? (jwks.keys ?? [])[0];
          if (jwk) {
            const key = await crypto.subtle.importKey(
              'jwk',
              { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
              { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
              false,
              ['verify'],
            );
            const raw = new TextEncoder().encode(`${h}.${p}`);
            const sig = new Uint8Array(
              atob(s.replace(/-/g, '+').replace(/_/g, '/'))
                .split('')
                .map((c) => c.charCodeAt(0)),
            );
            const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig, raw);
            if (ok) {
              const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))) as {
                sub?: string;
                iss?: string;
                aud?: string;
                exp?: number;
              };
              const now = Math.floor(Date.now() / 1000);
              if (
                payload.sub &&
                payload.iss === `https://securetoken.google.com/${project}` &&
                payload.aud === project &&
                (!payload.exp || payload.exp > now)
              ) {
                return { client: `uid:${payload.sub}`, verified: true };
              }
            }
          }
        }
      } catch {
        /* fall through to anonymous identity */
      }
    }
  }

  const anon = req.headers.get('X-Client-Id') ?? '';
  if (!anon) throw new Error('missing client identity');
  return { client: `browser:${anon.slice(0, 64)}`, verified: false };
}

/* -------------------------------- helpers -------------------------------- */

async function requireKey(env: Env, db: D1Database, client: string, provider: string): Promise<string> {
  const row = await db
    .prepare('SELECT ciphertext FROM credentials WHERE client = ? AND provider = ?')
    .bind(client, provider)
    .first<{ ciphertext: string }>();
  if (!row) throw new ProviderError(`No credential stored for "${provider}"`, 401);
  return decrypt(env.GATEWAY_SECRET ?? 'dev-secret-change-me', row.ciphertext);
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* --------------------------------- health -------------------------------- */

app.get('/health', (c) =>
  c.json({
    ok: true,
    providers: Object.keys(PROVIDER_DEFS),
    oauth: Object.keys(OAUTH_SERVICES),
    search: 'wikipedia+commons+duckduckgo (set SERPER_API_KEY / BRAVE_API_KEY for a full index)',
  }),
);

/* ------------------------------- providers ------------------------------- */

app.get('/providers', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const stored = await c.env.DB
    .prepare('SELECT provider, hint FROM credentials WHERE client = ?')
    .bind(client)
    .all<{ provider: string; hint: string }>();

  const tests = await c.env.DB
    .prepare('SELECT provider, ok, message, models, tested_at FROM tests WHERE client = ?')
    .bind(client)
    .all<{ provider: string; ok: number; message: string; models: number; tested_at: number }>();

  const connections: Record<string, unknown> = {};
  for (const s of stored.results ?? []) {
    connections[s.provider] = { connected: true, hint: s.hint };
  }
  for (const t of tests.results ?? []) {
    const base = (connections[t.provider] as Record<string, unknown> | undefined) ?? {};
    connections[t.provider] = {
      ...base,
      connected: Boolean(t.ok),
      lastTest: { ok: Boolean(t.ok), at: t.tested_at, message: t.message },
      models: t.models,
    };
  }
  return c.json({ connections });
});

app.post('/providers/:id/key', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const id = c.req.param('id');
  if (!PROVIDER_DEFS[id]) return jsonError(`unknown provider "${id}"`, 400);
  const body = (await c.req.json()) as { apiKey?: string };
  const key = body.apiKey?.trim();
  if (!key) return jsonError('apiKey is required', 400);

  const secret = c.env.GATEWAY_SECRET ?? 'dev-secret-change-me';
  await c.env.DB.prepare(
    `INSERT INTO credentials (client, provider, ciphertext, hint, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(client, provider) DO UPDATE SET ciphertext = excluded.ciphertext, hint = excluded.hint, updated_at = excluded.updated_at`,
  )
    .bind(client, id, await encrypt(secret, key), keyHint(key), Date.now())
    .run();

  return c.json({ ok: true, hint: keyHint(key) });
});

app.post('/providers/test', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const body = (await c.req.json()) as { provider?: string };
  const id = body.provider ?? '';
  if (!PROVIDER_DEFS[id]) return jsonError(`unknown provider "${id}"`, 400);

  let result = { ok: false, message: 'no credential', models: 0 };
  try {
    const key = await requireKey(c.env, c.env.DB, client, id);
    result = await testProvider(id, key);
  } catch (e) {
    result = { ok: false, message: (e as Error).message, models: 0 };
  }

  await c.env.DB.prepare(
    `INSERT INTO tests (client, provider, ok, message, models, tested_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(client, provider) DO UPDATE SET ok = excluded.ok, message = excluded.message, models = excluded.models, tested_at = excluded.tested_at`,
  )
    .bind(client, id, result.ok ? 1 : 0, result.message, result.models, Date.now())
    .run();

  return c.json(result);
});

app.delete('/providers/:id', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM credentials WHERE client = ? AND provider = ?').bind(client, id).run();
  await c.env.DB.prepare('DELETE FROM tests WHERE client = ? AND provider = ?').bind(client, id).run();
  return c.json({ ok: true });
});

async function modelsFor(env: Env, db: D1Database, client: string, provider?: string) {
  const secret = env.GATEWAY_SECRET ?? 'dev-secret-change-me';
  const rows = await db
    .prepare(provider ? 'SELECT provider FROM credentials WHERE client = ? AND provider = ?' : 'SELECT provider FROM credentials WHERE client = ?')
    .bind(...(provider ? [client, provider] : [client]))
    .all<{ provider: string }>();

  const out: unknown[] = [];
  const errors: Array<{ provider: string; message: string }> = [];

  for (const row of rows.results ?? []) {
    try {
      const key = await requireKey(env, db, client, row.provider);
      const models = await listModels(row.provider, key);
      for (const m of models) out.push({ ...m, provider: row.provider });
    } catch (e) {
      errors.push({ provider: row.provider, message: (e as Error).message });
    }
  }
  return { models: out, errors };
}

app.get('/providers/:id/models', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const id = c.req.param('id');
  if (!PROVIDER_DEFS[id]) return jsonError(`unknown provider "${id}"`, 400);
  const { models, errors } = await modelsFor(c.env, c.env.DB, client, id);
  return c.json({ models, errors });
});

app.get('/models', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const { models, errors } = await modelsFor(c.env, c.env.DB, client);
  return c.json({ models, errors });
});

/* ---------------------------------- chat --------------------------------- */

app.post('/chat', async (c) => {
  let client: string;
  try {
    client = (await identity(c.req.raw, c.env)).client;
  } catch (e) {
    return jsonError((e as Error).message, 401);
  }

  const body = (await c.req.json()) as {
    provider?: string;
    model?: string;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }>;
    system?: string;
    params?: ChatParams;
    webSearch?: boolean;
    research?: boolean;
    reasoning?: 'fast' | 'balanced' | 'advanced';
    locale?: string;
  };

  const provider = body.provider ?? '';
  const model = body.model ?? '';
  if (!PROVIDER_DEFS[provider]) return jsonError(`unknown provider "${provider}"`, 400);
  if (!model) return jsonError('model is required', 400);
  if (!body.messages?.length) return jsonError('messages is required', 400);

  let key: string;
  try {
    key = await requireKey(c.env, c.env.DB, client, provider);
  } catch (e) {
    return jsonError((e as Error).message, 401);
  }

  /* web search / deep research → sources first, then the prompt */
  const collected: Array<{ title: string; url: string; snippet?: string; publishedAt?: string; site?: string }> = [];
  const userText = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (body.webSearch && userText.trim()) {
    try {
      const results = body.research
        ? await deepResearch(userText)
        : await searchWeb(userText, body.research ? 'deep' : 'fast');
      collected.push(...results);
    } catch {
      /* search failure must not break the answer; the model is told there were no results */
    }
  }

  let system = body.system ?? '';
  if (collected.length) {
    const block = [
      '## Live web results (verbatim — do not invent others)',
      ...collected.map((r, i) => `${i + 1}. ${r.title} — ${r.url}${r.publishedAt ? ` (${r.publishedAt})` : ''}\n   ${r.snippet ?? ''}`),
      'Cite sources with Markdown links using exactly these URLs.',
    ].join('\n');
    system = `${system}\n\n${block}`;
  } else if (body.webSearch) {
    system = `${system}\n\nWeb search returned no results for this query. Say so plainly and do not invent links.`;
  }

  const signal = c.req.raw.signal;

  let stream: ReadableStream<string>;
  try {
    stream = await providerChat({
      provider,
      apiKey: key,
      model,
      messages: (body.messages ?? []) as WireMessage[],
      system,
      params: body.params,
      reasoning: body.reasoning,
      signal,
    });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    return jsonError((e as Error).message, status);
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      for (const s of collected) send({ type: 'source', source: s });
      const reader = stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of value.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) controller.enqueue(encoder.encode(`${trimmed}\n\n`));
          }
        }
      } catch (e) {
        send({ type: 'error', message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
    cancel() {
      void stream.cancel?.();
    },
  });

  return new Response(out, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});

/* -------------------------------- images --------------------------------- */

app.post('/images', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const body = (await c.req.json()) as {
    provider?: string;
    model?: string;
    prompt?: string;
    size?: string;
    quality?: string;
    n?: number;
    image?: string;
  };
  const provider = body.provider ?? '';
  if (!PROVIDER_DEFS[provider]) return jsonError(`unknown provider "${provider}"`, 400);
  if (!body.prompt) return jsonError('prompt is required', 400);
  try {
    const key = await requireKey(c.env, c.env.DB, client, provider);
    const images = await generateImages({
      provider,
      apiKey: key,
      model: body.model ?? 'gpt-image-1',
      prompt: body.prompt,
      size: body.size,
      quality: body.quality,
      n: body.n,
      image: body.image,
    });
    return c.json({ images });
  } catch (e) {
    return jsonError((e as Error).message, e instanceof ProviderError ? e.status : 500);
  }
});

/* -------------------------------- search --------------------------------- */

app.post('/search', async (c) => {
  await identity(c.req.raw, c.env);
  const body = (await c.req.json()) as { query?: string; mode?: 'fast' | 'deep' | 'images' | 'news' };
  if (!body.query) return jsonError('query is required', 400);
  const mode = body.mode === 'images' ? 'fast' : (body.mode ?? 'fast');
  const results = mode === 'deep' ? await deepResearch(body.query) : await searchWeb(body.query, mode);
  return c.json({ results });
});

app.post('/search/images', async (c) => {
  await identity(c.req.raw, c.env);
  const body = (await c.req.json()) as { query?: string; limit?: number };
  if (!body.query) return jsonError('query is required', 400);
  return c.json({ results: await searchImages(body.query, body.limit ?? 8) });
});

/* ------------------------------ integrations ----------------------------- */

function appOrigin(c: { req: Request; env: Env }): string {
  return c.env.APP_ORIGIN ?? new URL(c.req.url).origin;
}
void appOrigin;

app.get('/integrations', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const rows = await c.env.DB
    .prepare('SELECT service, account, scopes, verified, updated_at FROM integrations WHERE client = ?')
    .bind(client)
    .all<{ service: string; account: string; scopes: string; verified: number; updated_at: number }>();
  const connections: Record<string, unknown> = {};
  for (const r of rows.results ?? []) {
    connections[r.service] = {
      status: 'connected',
      account: r.account || undefined,
      scopes: r.scopes ? r.scopes.split(' ') : [],
      verified: Boolean(r.verified),
      updatedAt: r.updated_at,
    };
  }
  return c.json({ connections });
});

app.post('/integrations/:id/connect', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const id = c.req.param('id');
  if (!OAUTH_SERVICES[id]) return jsonError(`"${id}" does not expose an OAuth flow in this gateway`, 400);

  const state = base64url(crypto.getRandomValues(new Uint8Array(18)));
  const gatewayOrigin = new URL(c.req.url).origin;
  const redirectUri = `${gatewayOrigin}/api/oauth/callback`;
  const appHome = c.req.header('Origin') ?? c.env.APP_ORIGIN ?? gatewayOrigin;

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO oauth_state (state, client, service, redirect, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(state, client, id, appHome, Date.now())
    .run();

  try {
    const url = await beginOAuth({
      service: id,
      client,
      env: c.env,
      redirectUri,
      state,
      saveState: async (s, verifier) => {
        await c.env.DB.prepare('UPDATE oauth_state SET service = ? WHERE state = ?').bind(`${id}:${verifier}`, s).run();
      },
    });
    return c.json({ url });
  } catch (e) {
    await c.env.DB.prepare('DELETE FROM oauth_state WHERE state = ?').bind(state).run();
    return jsonError((e as Error).message, 400);
  }
});

app.get('/api/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return jsonError('missing code/state', 400);

  const row = await c.env.DB
    .prepare('SELECT client, service, redirect, created_at FROM oauth_state WHERE state = ?')
    .bind(state)
    .first<{ client: string; service: string; redirect: string; created_at: number }>();
  if (!row) return jsonError('unknown or expired state', 400);
  if (Date.now() - row.created_at > 10 * 60_000) return jsonError('state expired', 400);

  const [service, verifier] = (row.service ?? '').split(':');
  const redirectUri = `${new URL(c.req.url).origin}/api/oauth/callback`;

  try {
    const token = await finishOAuth({ service, env: c.env, code, verifier, redirectUri });
    const check = await validateToken(service, token.token);
    await saveConnection(
      c.env.DB,
      c.env.GATEWAY_SECRET ?? 'dev-secret-change-me',
      row.client,
      service,
      token.token,
      check.account,
      token.scopes,
    );
    await c.env.DB.prepare('UPDATE integrations SET verified = ? WHERE client = ? AND service = ?')
      .bind(check.ok ? 1 : 0, row.client, service)
      .run();
    await c.env.DB.prepare('DELETE FROM oauth_state WHERE state = ?').bind(state).run();
    return c.redirect(`${row.redirect}/integrations?connected=${encodeURIComponent(service)}`);
  } catch (e) {
    await c.env.DB.prepare('DELETE FROM oauth_state WHERE state = ?').bind(state).run();
    return c.redirect(`${row.redirect}/integrations?error=${encodeURIComponent((e as Error).message)}`);
  }
});

app.post('/integrations/:id/token', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const id = c.req.param('id');
  const body = (await c.req.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) return jsonError('token is required', 400);

  const check = await validateToken(id, token);
  await saveConnection(
    c.env.DB,
    c.env.GATEWAY_SECRET ?? 'dev-secret-change-me',
    client,
    id,
    token,
    check.account,
    '',
  );
  await c.env.DB.prepare('UPDATE integrations SET verified = ? WHERE client = ? AND service = ?')
    .bind(check.ok ? 1 : 0, client, id)
    .run();

  return c.json({ ok: check.ok, account: check.account, verified: check.ok, message: check.message });
});

app.delete('/integrations/:id', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  await c.env.DB.prepare('DELETE FROM integrations WHERE client = ? AND service = ?')
    .bind(client, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});

app.post('/integrations/:id/tools/:tool', async (c) => {
  const { client } = await identity(c.req.raw, c.env);
  const service = c.req.param('id');
  const toolId = c.req.param('tool');
  const args = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const token = await readToken(c.env.DB, c.env.GATEWAY_SECRET ?? 'dev-secret-change-me', client, service);
  if (!token) return jsonError(`"${service}" is not connected`, 401);

  try {
    const result = await runTool(service, toolId, token, c.env, args);
    return c.json({ result });
  } catch (e) {
    return jsonError((e as Error).message, 502);
  }
});

app.get('/integrations/:id/tools', async (c) => {
  await identity(c.req.raw, c.env);
  return c.json({ tools: toolsFor(c.req.param('id')).map((t) => ({ id: t.id, sensitive: Boolean(t.sensitive) })) });
});

/* --------------------------------- misc ---------------------------------- */

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

app.onError((err, c) => {
  if (err instanceof ProviderError) return jsonError(err.message, err.status);
  const message = err.message === 'missing client identity' ? 'missing client identity' : err.message;
  return jsonError(message, err.message === 'missing client identity' ? 401 : 500);
});

app.notFound((c) => jsonError(`no route for ${c.req.method} ${c.req.path}`, 404));

export default {
  async fetch(request: Request, env: { DB: D1Database } & Record<string, string>) {
    configureSearch({ serper: env.SERPER_API_KEY, brave: env.BRAVE_API_KEY });
    return app.fetch(request, env);
  },
};
