/**
 * AI Provider layer.
 *
 * One adapter per transport protocol; every vendor maps to exactly one of
 * them. The UI never talks to this code directly — it calls the HTTP routes in
 * index.ts, which attach the decrypted key for the calling client.
 *
 * Streaming: vendor SSE is parsed and re-emitted in the gateway event format
 * (text / reasoning / source / error / done) so the browser only ever learns
 * one protocol.
 */

export type Protocol =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cohere'
  | 'azure'
  | 'bedrock'
  | 'replicate';

export interface ProviderDef {
  id: string;
  protocol: Protocol;
  /** Base URL without trailing slash. `azure`/`bedrock` are derived from the key. */
  base: string;
  label: string;
}

export const PROVIDER_DEFS: Record<string, ProviderDef> = {
  openrouter: { id: 'openrouter', protocol: 'openai', base: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
  openai: { id: 'openai', protocol: 'openai', base: 'https://api.openai.com/v1', label: 'OpenAI' },
  anthropic: { id: 'anthropic', protocol: 'anthropic', base: 'https://api.anthropic.com/v1', label: 'Anthropic' },
  google: { id: 'google', protocol: 'google', base: 'https://generativelanguage.googleapis.com/v1beta', label: 'Google AI' },
  deepseek: { id: 'deepseek', protocol: 'openai', base: 'https://api.deepseek.com/v1', label: 'DeepSeek' },
  mistral: { id: 'mistral', protocol: 'openai', base: 'https://api.mistral.ai/v1', label: 'Mistral AI' },
  xai: { id: 'xai', protocol: 'openai', base: 'https://api.x.ai/v1', label: 'xAI' },
  groq: { id: 'groq', protocol: 'openai', base: 'https://api.groq.com/openai/v1', label: 'Groq' },
  together: { id: 'together', protocol: 'openai', base: 'https://api.together.xyz/v1', label: 'Together AI' },
  fireworks: { id: 'fireworks', protocol: 'openai', base: 'https://api.fireworks.ai/inference/v1', label: 'Fireworks AI' },
  cohere: { id: 'cohere', protocol: 'cohere', base: 'https://api.cohere.com/v2', label: 'Cohere' },
  perplexity: { id: 'perplexity', protocol: 'openai', base: 'https://api.perplexity.ai', label: 'Perplexity' },
  huggingface: { id: 'huggingface', protocol: 'openai', base: 'https://router.huggingface.co/v1', label: 'Hugging Face' },
  cerebras: { id: 'cerebras', protocol: 'openai', base: 'https://api.cerebras.ai/v1', label: 'Cerebras' },
  sambanova: { id: 'sambanova', protocol: 'openai', base: 'https://api.sambanova.ai/v1', label: 'SambaNova' },
  nvidia: { id: 'nvidia', protocol: 'openai', base: 'https://integrate.api.nvidia.com/v1', label: 'NVIDIA NIM' },
  azure: { id: 'azure', protocol: 'azure', base: '', label: 'Azure AI' },
  bedrock: { id: 'bedrock', protocol: 'bedrock', base: '', label: 'Amazon Bedrock' },
  github: { id: 'github', protocol: 'openai', base: 'https://models.github.ai/inference', label: 'GitHub Models' },
  replicate: { id: 'replicate', protocol: 'replicate', base: 'https://api.replicate.com/v1', label: 'Replicate' },
};

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------ key helpers ----------------------------- */

function splitKey(provider: string, key: string): string[] {
  return provider === 'azure' || provider === 'bedrock' ? key.split(':') : [key];
}

function authHeaders(provider: string, key: string): Record<string, string> {
  const def = PROVIDER_DEFS[provider];
  if (!def) throw new ProviderError(`unknown provider "${provider}"`, 400);

  switch (def.protocol) {
    case 'anthropic':
      return {
        'x-api-key': key.trim(),
        'anthropic-version': '2023-06-01',
        // required by Anthropic for calls made straight from a browser
        'anthropic-dangerous-direct-browser-access': 'true',
      };
    case 'google':
      return { 'x-goog-api-key': key.trim() };
    case 'cohere':
      return { Authorization: `Bearer ${key.trim()}` };
    case 'azure': {
      const [, apiKey] = splitKey(provider, key);
      if (!apiKey) throw new ProviderError('Azure key must be "endpoint:api-key"', 400);
      return { 'api-key': apiKey.trim() };
    }
    case 'bedrock': {
      const [, access, secret] = splitKey(provider, key);
      if (!access || !secret) {
        throw new ProviderError('Bedrock key must be "region:accessKeyId:secretAccessKey"', 400);
      }
      return {}; // signed per-request
    }
    default:
      return { Authorization: `Bearer ${key.trim()}` };
  }
}

function baseUrl(provider: string, key: string): string {
  const def = PROVIDER_DEFS[provider];
  if (!def) throw new ProviderError(`unknown provider "${provider}"`, 400);
  if (def.protocol === 'azure') {
    const [endpoint] = splitKey(provider, key);
    if (!endpoint?.startsWith('http')) throw new ProviderError('Azure key must be "https://<resource>.openai.azure.com:api-key"', 400);
    return `${endpoint.replace(/\/$/, '')}/openai`;
  }
  return def.base;
}

/* ------------------------------ messages -------------------------------- */

export interface WireMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  response_format?: { type: 'text' | 'json_object' };
  reasoning_effort?: 'low' | 'medium' | 'high';
  [k: string]: unknown;
}

export interface ChatRequest {
  provider: string;
  apiKey: string;
  model: string;
  messages: WireMessage[];
  system?: string;
  params?: ChatParams;
  reasoning?: 'fast' | 'balanced' | 'advanced';
  signal?: AbortSignal;
}

/** Encoder helpers shared by the protocols. */
function openAiMessages(messages: WireMessage[]): unknown[] {
  return messages.map((m) => {
    if (!m.images?.length) return { role: m.role, content: m.content };
    const parts: unknown[] = [{ type: 'text', text: m.content }];
    for (const url of m.images) parts.push({ type: 'image_url', image_url: { url } });
    return { role: m.role, content: parts };
  });
}

/* ------------------------------ SSE parsing ----------------------------- */

async function* sseEvents(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new ProviderError('provider returned an empty body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n');
    buffer = chunks.pop() ?? '';
    for (const raw of chunks) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data) yield data;
    }
  }
}

export type GatewayEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export function encoder(): TransformStream<GatewayEvent, string> {
  return new TransformStream<GatewayEvent, string>({
    transform(ev, controller) {
      controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
    },
  });
}

/* -------------------------------- chat ---------------------------------- */

export async function providerChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { provider, apiKey, model } = req;
  const def = PROVIDER_DEFS[provider];
  if (!def) throw new ProviderError(`unknown provider "${provider}"`, 400);

  switch (def.protocol) {
    case 'openai':
    case 'azure':
      return openAiChat(req);
    case 'anthropic':
      return anthropicChat(req);
    case 'google':
      return googleChat(req);
    case 'cohere':
      return cohereChat(req);
    case 'bedrock':
      return bedrockChat(req);
    case 'replicate':
      return replicateChat(req);
    default:
      throw new ProviderError(`no adapter for "${provider}"`, 501);
  }
}

function failed(res: Response, body: string): never {
  let message = body.slice(0, 400);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    if (typeof parsed.error === 'string') message = parsed.error;
    else if (parsed.error?.message) message = parsed.error.message;
  } catch {
    /* keep raw */
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError(`Authentication failed: ${message}`, 401);
  if (res.status === 429) throw new ProviderError(`Rate limited: ${message}`, 429);
  if (res.status === 404) throw new ProviderError(`Not found: ${message}`, 404);
  throw new ProviderError(message, res.status >= 500 ? 502 : res.status);
}

async function openAiChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { provider, apiKey, model, system, params, reasoning, signal } = req;
  const base = baseUrl(provider, apiKey);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(provider, apiKey),
  };

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...openAiMessages(req.messages),
    ],
    stream: true,
    ...(params ?? {}),
  };
  // Only send an effort the user explicitly opted into: unknown request fields
  // are rejected by several vendors, so the default stays out of the payload.
  if (reasoning === 'advanced') body.reasoning_effort = 'high';

  const res = await fetch(`${base}/chat/completions${provider === 'azure' ? '?api-version=2024-10-21' : ''}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) failed(res, await res.text());

  const out = new ReadableStream<string>({
    async start(controller) {
      const send = (ev: GatewayEvent) => controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
      try {
        for await (const data of sseEvents(res)) {
          if (data === '[DONE]') break;
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (frame.error) {
            const err = frame.error as { message?: string };
            send({ type: 'error', message: err.message ?? 'provider error' });
            break;
          }
          const choices = frame.choices as Array<Record<string, unknown>> | undefined;
          const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
          const reasoningText = delta?.reasoning_content ?? delta?.reasoning;
          if (typeof reasoningText === 'string' && reasoningText) {
            send({ type: 'reasoning', text: reasoningText });
          }
          const content = delta?.content;
          if (typeof content === 'string' && content) send({ type: 'text', text: content });
          const contentV2 = (choices?.[0]?.message as Record<string, unknown> | undefined)?.content;
          if (typeof contentV2 === 'string' && contentV2) send({ type: 'text', text: contentV2 });
        }
        send({ type: 'done' });
      } catch (e) {
        send({ type: 'error', message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return out;
}

async function anthropicChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { apiKey, model, system, params, reasoning, signal } = req;
  const body: Record<string, unknown> = {
    model,
    max_tokens: params?.max_tokens ?? 4096,
    system,
    stream: true,
    messages: req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (!m.images?.length) return { role: m.role, content: m.content };
        const content: unknown[] = [{ type: 'text', text: m.content }];
        for (const url of m.images) {
          const [meta, data] = url.startsWith('data:') ? url.split(',') : ['', ''];
          const media = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png';
          content.push({ type: 'image', source: { type: 'base64', media_type: media, data } });
        }
        return { role: m.role, content };
      }),
    ...(params?.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params?.top_p !== undefined ? { top_p: params.top_p } : {}),
    ...(params?.stop ? { stop_sequences: params.stop } : {}),
  };
  if (reasoning === 'advanced') body.thinking = { type: 'enabled', budget_tokens: 8192 };

  const res = await fetch(`${PROVIDER_DEFS.anthropic.base}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders('anthropic', apiKey) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) failed(res, await res.text());

  const out = new ReadableStream<string>({
    async start(controller) {
      const send = (ev: GatewayEvent) => controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
      try {
        for await (const data of sseEvents(res)) {
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }
          const type = String(frame.type ?? '');
          if (type === 'content_block_delta') {
            const delta = frame.delta as Record<string, unknown> | undefined;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              send({ type: 'text', text: delta.text });
            } else if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
              send({ type: 'reasoning', text: delta.thinking });
            }
          } else if (type === 'error') {
            const err = frame.error as { message?: string } | undefined;
            send({ type: 'error', message: err?.message ?? 'provider error' });
            break;
          }
        }
        send({ type: 'done' });
      } catch (e) {
        send({ type: 'error', message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return out;
}

async function googleChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { apiKey, model, system, params, reasoning, signal } = req;
  const url = `${PROVIDER_DEFS.google.base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const contents = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.images ?? []).map((u) => ({ inlineData: splitDataUrl(u) })),
      ],
    }));

  const body: Record<string, unknown> = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      ...(params?.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params?.top_p !== undefined ? { topP: params.top_p } : {}),
      ...(params?.max_tokens !== undefined ? { maxOutputTokens: params.max_tokens } : {}),
      ...(params?.response_format?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}),
      ...(reasoning === 'advanced' ? { thinkingConfig: { thinkingBudget: 2048 } } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders('google', apiKey) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) failed(res, await res.text());

  const out = new ReadableStream<string>({
    async start(controller) {
      const send = (ev: GatewayEvent) => controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
      try {
        for await (const data of sseEvents(res)) {
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }
          const candidates = frame.candidates as Array<Record<string, unknown>> | undefined;
          const parts = (candidates?.[0]?.content as Record<string, unknown> | undefined)?.parts as
            | Array<Record<string, unknown>>
            | undefined;
          for (const part of parts ?? []) {
            if (typeof part.text === 'string' && part.text) {
              if (part.thought === true) send({ type: 'reasoning', text: part.text });
              else send({ type: 'text', text: part.text });
            }
          }
        }
        send({ type: 'done' });
      } catch (e) {
        send({ type: 'error', message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return out;
}

function splitDataUrl(url: string): { mimeType: string; data: string } {
  if (!url.startsWith('data:')) return { mimeType: 'image/png', data: url };
  const [meta, data = ''] = url.split(',');
  const mimeType = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png';
  return { mimeType, data };
}

/** Cohere v2 — non-streaming request, replayed as gateway events. */
async function cohereChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { apiKey, model, system, params, signal } = req;
  const res = await fetch(`${PROVIDER_DEFS.cohere.base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders('cohere', apiKey) },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      ...(params?.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params?.max_tokens !== undefined ? { maxTokens: params.max_tokens } : {}),
      stream: false,
    }),
    signal,
  });
  if (!res.ok) failed(res, await res.text());
  const json = (await res.json()) as { message?: { content?: Array<{ text?: string }> } };
  const text = (json.message?.content ?? []).map((c) => c.text ?? '').join('');

  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ type: 'text', text } as GatewayEvent)}\n\n`);
      controller.enqueue(`data: ${JSON.stringify({ type: 'done' } as GatewayEvent)}\n\n`);
      controller.close();
    },
  });
}

/* --------------------------- AWS SigV4 (Bedrock) ------------------------ */

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? (key.buffer as ArrayBuffer) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function bedrockChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { apiKey, model, system, params, signal } = req;
  const [region, accessKey, secretKey] = apiKey.split(':');
  if (!region || !accessKey || !secretKey) {
    throw new ProviderError('Bedrock key must be "region:accessKeyId:secretAccessKey"', 400);
  }
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const path = `/model/${encodeURIComponent(model)}/invoke`;
  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: params?.max_tokens ?? 2048,
    system,
    messages: req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    ...(params?.temperature !== undefined ? { temperature: params.temperature } : {}),
  });

  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(payload);
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  const kDate = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 'bedrock');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = [...new Uint8Array(await hmac(kSigning, stringToSign))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const res = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: payload,
    signal,
  });
  if (!res.ok) failed(res, await res.text());
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = (json.content ?? []).map((c) => c.text ?? '').join('');

  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ type: 'text', text } as GatewayEvent)}\n\n`);
      controller.enqueue(`data: ${JSON.stringify({ type: 'done' } as GatewayEvent)}\n\n`);
      controller.close();
    },
  });
}

/* ------------------------------- Replicate ------------------------------ */

async function replicateChat(req: ChatRequest): Promise<ReadableStream<string>> {
  const { apiKey, model, signal } = req;
  const id = model.includes(':') ? model : model;
  const res = await fetch(`${PROVIDER_DEFS.replicate.base}/models/${id}/predictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      Prefer: 'wait=60',
    },
    body: JSON.stringify({ input: { prompt: req.messages.map((m) => m.content).join('\n\n') } }),
    signal,
  });
  if (!res.ok) failed(res, await res.text());
  const json = (await res.json()) as { output?: unknown; error?: string };
  if (json.error) throw new ProviderError(json.error, 502);

  const out = Array.isArray(json.output)
    ? json.output.map((x) => String(x)).join('\n')
    : typeof json.output === 'string'
      ? json.output
      : JSON.stringify(json.output ?? '');

  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ type: 'text', text: out } as GatewayEvent)}\n\n`);
      controller.enqueue(`data: ${JSON.stringify({ type: 'done' } as GatewayEvent)}\n\n`);
      controller.close();
    },
  });
}

/* ------------------------------ model lists ----------------------------- */

export interface RawModel {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  description?: string;
  pricing?: { input?: number; output?: number; free?: boolean };
  capabilities?: string[];
  parameters?: string[];
  updated_at?: string;
  verified?: boolean;
}

export async function listModels(provider: string, key: string): Promise<RawModel[]> {
  const def = PROVIDER_DEFS[provider];
  if (!def) throw new ProviderError(`unknown provider "${provider}"`, 400);
  const headers = { Accept: 'application/json', ...authHeaders(provider, key) };
  const base = baseUrl(provider, key);

  if (def.protocol === 'azure') {
    const [endpoint] = splitKey(provider, key);
    const res = await fetch(`${endpoint}/openai/models?api-version=2024-10-21`, { headers });
    if (!res.ok) failed(res, await res.text());
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map((m) => ({ id: m.id, provider }));
  }

  if (def.protocol === 'replicate') {
    const res = await fetch(`${def.base}/models?limit=100`, { headers });
    if (!res.ok) failed(res, await res.text());
    const json = (await res.json()) as { results?: Array<{ url?: string; description?: string }> };
    return (json.results ?? [])
      .filter((m) => Boolean(m.url))
      .map((m) => ({
        id: (m.url ?? '').replace('https://replicate.com/', ''),
        provider,
        description: m.description,
      }));
  }

  if (def.protocol === 'bedrock') {
    // ListFoundationModels needs a different (signed) request; report honestly.
    throw new ProviderError(
      'Listing Bedrock models requires a signed ListFoundationModels call that this gateway build does not perform. Add the model id manually or use a provider with a catalog endpoint.',
      501,
    );
  }

  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) failed(res, await res.text());
  const json = (await res.json()) as Record<string, unknown>;
  const data = (json.data ?? json.models ?? []) as Array<Record<string, unknown>>;

  return data.map((m) => {
    const id = String(m.id ?? m.name ?? '');
    const ctx = Number(m.context_length ?? m.contextWindow ?? 0) || undefined;
    const architecture = m.architecture as { modality?: string } | undefined;
    const pricing = m.pricing as Record<string, string | number> | undefined;
    const input = pricing?.prompt !== undefined ? Number(pricing.prompt) : pricing?.input !== undefined ? Number(pricing.input) : undefined;
    const output = pricing?.completion !== undefined ? Number(pricing.completion) : pricing?.output !== undefined ? Number(pricing.output) : undefined;
    const caps: string[] = [];
    if (m.capabilities) caps.push(...(m.capabilities as string[]));
    if (architecture?.modality) {
      if (architecture.modality.includes('text+image')) caps.push('vision', 'imageInput');
    }
    if (m.supports_vision) caps.push('vision');
    if (m.supports_function_calling) caps.push('tools');
    if (m.supports_reasoning) caps.push('reasoning');
    return {
      id,
      name: String(m.name ?? id),
      provider,
      contextWindow: ctx,
      description: typeof m.description === 'string' ? m.description : undefined,
      pricing:
        input !== undefined || output !== undefined
          ? { input, output, free: input === 0 && output === 0 }
          : undefined,
      capabilities: [...new Set(caps)],
      updated_at: typeof m.created === 'number' ? new Date(m.created * 1000).toISOString() : undefined,
      verified: true,
    } satisfies RawModel;
  });
}

/** Lightweight reachability test used by the "Test connection" button. */
export async function testProvider(provider: string, key: string): Promise<{ ok: boolean; message: string; models: number }> {
  try {
    const models = await listModels(provider, key);
    return { ok: true, message: `${models.length} models visible`, models: models.length };
  } catch (e) {
    const err = e as Error;
    return { ok: false, message: err.message, models: 0 };
  }
}

/* ----------------------------- image studio ----------------------------- */

export async function generateImages(args: {
  provider: string;
  apiKey: string;
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  n?: number;
  image?: string;
}): Promise<Array<{ url?: string; b64?: string }>> {
  const { provider, apiKey, model, prompt, size, quality, n = 1, image } = args;
  const headers = { 'Content-Type': 'application/json', ...authHeaders(provider, apiKey) };
  const base = baseUrl(provider, apiKey);

  if (image) {
    // edits / variations with an uploaded reference image
    const form = new FormData();
    const [meta, data = ''] = image.split(',');
    const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png';
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    form.append('image', new File([bytes], 'input.png', { type: mime }));
    form.append('prompt', prompt);
    form.append('n', String(n));
    if (size) form.append('size', size);
    const res = await fetch(`${base}/images/edits`, { method: 'POST', headers: authHeaders(provider, apiKey), body: form });
    if (!res.ok) failed(res, await res.text());
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    return (json.data ?? []).map((d) => ({ url: d.url, b64: d.b64_json }));
  }

  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, prompt, n, ...(size ? { size } : {}), ...(quality ? { quality } : {}), response_format: 'b64_json' }),
  });
  if (!res.ok) failed(res, await res.text());
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  return (json.data ?? []).map((d) => ({ url: d.url, b64: d.b64_json }));
}
