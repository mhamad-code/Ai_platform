import { create } from 'zustand';
import type { ChatMessage, ReasoningLevel, SourceItem } from '../ai/types';
import { buildSystemPrompt } from '../ai/prompt';
import { gatewayEnabled, gatewayHealth, streamChat, GatewayError } from '../lib/gateway';
import { chats as chatWs, messages as msgWs, modelParams as modelParamsWs, type ChatMeta, type ModelParams } from '../lib/workspace';
import { uid } from '../lib/utils';
import { useSettings } from './settings';
import { useProviders } from './providers';
import { useUI } from './ui';
import { useProjects } from './projects';

export interface PendingAttachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: 'image' | 'pdf' | 'doc' | 'sheet' | 'text' | 'code' | 'other';
  dataUrl?: string;
  text?: string;
}

interface ChatState {
  chats: ChatMeta[];
  archived: ChatMeta[];
  activeId: string | null;
  messages: ChatMessage[];
  stream: { text: string; sources: SourceItem[]; reasoning: string } | null;
  streaming: boolean;
  error: string | null;
  model: string | null;
  webSearch: boolean;
  deepResearch: boolean;
  reasoning: ReasoningLevel;
  temporary: boolean;
  projectId: string | null;

  watch: () => () => void;
  setOption: <K extends 'webSearch' | 'deepResearch' | 'reasoning' | 'temporary' | 'model' | 'projectId'>(
    k: K,
    v: ChatState[K],
  ) => void;
  open: (id: string | null) => () => void;
  create: (init?: Partial<ChatMeta>) => Promise<string>;
  send: (args: { text: string; attachments?: PendingAttachment[] }) => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
  rate: (id: string, v: 1 | -1) => void;
  patchChat: (id: string, patch: Partial<ChatMeta>) => void;
  removeChat: (id: string) => Promise<void>;
  clear: () => void;
}

let unsubMessages: (() => void) | null = null;
let abort: AbortController | null = null;

export function messageText(m: ChatMessage): string {
  if (typeof m.content === 'string') return m.content;
  return m.content
    .map((p) => (p.type === 'text' ? (p.text ?? '') : `[${p.name ?? p.type}]`))
    .join('\n');
}

function errorKey(e: unknown): string {
  if (e instanceof GatewayError) {
    if (e.kind === 'auth') return 'chat.errorAuth';
    if (e.kind === 'quota') return 'chat.errorQuota';
    if (e.kind === 'notConfigured' || e.kind === 'network') return 'chat.errorNetwork';
    return 'chat.errorGeneric';
  }
  return 'chat.errorGeneric';
}

export const useChat = create<ChatState>()((set, get) => ({
  chats: [],
  archived: [],
  activeId: null,
  messages: [],
  stream: null,
  streaming: false,
  error: null,
  model: useSettings.getState().defaultModel,
  webSearch: useSettings.getState().webSearchDefault,
  deepResearch: false,
  reasoning: 'balanced',
  temporary: false,
  projectId: null,

  watch: () =>
    chatWs.subscribe((rows) => {
      set({ chats: rows.filter((c) => !c.archived), archived: rows.filter((c) => c.archived) });
    }),

  setOption: (k, v) => set({ [k]: v } as Partial<ChatState>),

  open: (id) => {
    unsubMessages?.();
    unsubMessages = null;
    set({ activeId: id, messages: [], error: null, stream: null });
    if (!id) return () => undefined;
    unsubMessages = msgWs.subscribe(id, (rows) => set({ messages: rows }));
    return () => {
      unsubMessages?.();
      unsubMessages = null;
    };
  },

  create: async (init) => {
    const settings = useSettings.getState();
    const model = init?.model ?? get().model ?? settings.defaultModel ?? '';
    const id = uid();
    const chat: ChatMeta = {
      id,
      title: init?.title ?? 'New chat',
      model,
      projectId: init?.projectId ?? get().projectId,
      temporary: get().temporary,
      webSearch: get().webSearch,
      category: init?.category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    if (!get().temporary) await chatWs.save(chat);
    set({ activeId: id, messages: [], error: null });
    return id;
  },

  send: async ({ text, attachments }) => {
    const state = get();
    if (!text.trim() && !attachments?.length) return;
    if (state.streaming) return;

    const settings = useSettings.getState();
    const providers = useProviders.getState();

    const modelId = state.model ?? settings.defaultModel ?? providers.models[0]?.id ?? null;
    const modelInfo = providers.models.find((m) => m.id === modelId);
    if (!modelId || !modelInfo) {
      set({ error: 'chat.notConfiguredTitle' });
      return;
    }
    const healthy = providers.health || (await gatewayHealth());
    if (!gatewayEnabled || !healthy) {
      set({ error: 'chat.notConfiguredTitle' });
      return;
    }

    let chatId = state.activeId;
    if (!chatId) chatId = await get().create({ title: text.slice(0, 48) });

    const parts: ChatMessage['content'] = [];
    if (text.trim()) parts.push({ type: 'text', text: text.trim() });
    for (const a of attachments ?? []) {
      if (a.dataUrl) parts.push({ type: 'image', url: a.dataUrl, name: a.name, mimeType: a.mime });
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: parts,
      createdAt: Date.now(),
      model: modelId,
      provider: modelInfo.provider,
      attachments: attachments?.map(({ id, name, size, mime, kind }) => ({ id, name, size, mime, kind })) ?? [],
      extracted: attachments
        ?.filter((a) => a.text?.trim())
        .map((a) => `[${a.name}]\n${a.text}`)
        .join('\n\n'),
    };

    const history = [...state.messages, userMsg];

    if (state.temporary) {
      set({ messages: history });
    } else {
      await msgWs.save(chatId, userMsg);
      await chatWs.patch(chatId, {
        updatedAt: Date.now(),
        messageCount: history.length,
        preview: text.slice(0, 120),
        model: modelId,
        projectId: state.projectId,
        title: isUntitled(state.chats.find((c) => c.id === chatId)?.title)
          ? text.slice(0, 48)
          : state.chats.find((c) => c.id === chatId)?.title ?? text.slice(0, 48),
      });
    }

    await runStream({ chatId, history, modelId, provider: modelInfo.provider, temporary: state.temporary });
  },

  retry: async () => {
    const { messages, activeId, streaming, temporary } = get();
    if (streaming || !activeId) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const keep =
      messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages;
    if (!temporary) {
      await msgWs.clear(activeId);
      for (const m of keep) await msgWs.save(activeId, m);
    }
    set({ messages: keep, error: null });
    await get().send({ text: messageText(lastUser) });
  },

  stop: () => {
    abort?.abort();
    abort = null;
    set({ streaming: false });
  },

  rate: (id, v) => {
    const chatId = get().activeId;
    const m = get().messages.find((x) => x.id === id);
    if (!m || !chatId) return;
    const patched: ChatMessage = { ...m, rating: v };
    set((s) => ({ messages: s.messages.map((x) => (x.id === id ? patched : x)) }));
    void msgWs.save(chatId, patched);
  },

  patchChat: (id, patch) => void chatWs.patch(id, patch),

  removeChat: async (id) => {
    await chatWs.remove(id);
    if (get().activeId === id) {
      unsubMessages?.();
      unsubMessages = null;
      set({ activeId: null, messages: [] });
    }
  },

  clear: () => {
    unsubMessages?.();
    unsubMessages = null;
    set({ activeId: null, messages: [], error: null, stream: null, streaming: false });
  },
}));

const UNTITLED = new Set(['New chat', 'محادثة جديدة', '']);
function isUntitled(t?: string) {
  return t === undefined || UNTITLED.has(t);
}

interface StreamArgs {
  chatId: string;
  history: ChatMessage[];
  modelId: string;
  provider: string;
  temporary: boolean;
}

/** Maps saved per-model settings to vendor request fields (only when set). */
function mapParams(row: ModelParams | undefined): Record<string, unknown> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  if (row.temperature !== undefined) out.temperature = row.temperature;
  if (row.topP !== undefined) out.top_p = row.topP;
  if (row.maxTokens !== undefined) out.max_tokens = row.maxTokens;
  if (row.frequencyPenalty !== undefined) out.frequency_penalty = row.frequencyPenalty;
  if (row.presencePenalty !== undefined) out.presence_penalty = row.presencePenalty;
  if (row.stop && row.stop.length) out.stop = row.stop;
  if (row.seed !== undefined) out.seed = row.seed;
  if (row.reasoningEffort) out.reasoning_effort = row.reasoningEffort;
  if (row.responseFormat === 'json') out.response_format = { type: 'json_object' };
  return out;
}

/** One-shot read of the stored settings for a model, with a short timeout. */
function readModelParams(modelId: string): Promise<ModelParams | undefined> {
  return new Promise((resolve) => {
    let unsub: (() => void) | null = null;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub?.();
      resolve(undefined);
    }, 700);
    const cb = (rows: ModelParams[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const row = rows.find((r) => r.modelId === modelId);
      unsub?.();
      resolve(row);
    };
    unsub = modelParamsWs.subscribe(cb);
    if (settled) {
      clearTimeout(timer);
      unsub();
    }
  });
}

async function runStream({ chatId, history, modelId, provider, temporary }: StreamArgs) {
  const settings = useSettings.getState();
  const opts = useChat.getState();
  const project = useProjects.getState().projects.find((p) => p.id === opts.projectId);
  const saved = await readModelParams(modelId);

  const system = [
    buildSystemPrompt({
      lang: settings.lang,
      projectInstructions: project?.instructions,
      model: modelId,
      webSearch: opts.webSearch,
      temporary,
      contextBlocks: [],
    }),
    saved?.system?.trim() ? `## Model system instructions\n${saved.system.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const params = mapParams(saved);

  const payload = {
    provider,
    model: modelId,
    messages: history.map((m) => ({
      role: m.role,
      content: messageText(m) + (m.extracted ? `\n\n<attached_files>\n${m.extracted}\n</attached_files>` : ''),
      images:
        typeof m.content === 'object'
          ? m.content.filter((p) => p.type === 'image').map((p) => p.url)
          : [],
    })),
    system,
    params,
    webSearch: opts.webSearch,
    research: opts.deepResearch,
    reasoning: opts.reasoning,
    temporary,
    locale: settings.lang,
  };

  abort = new AbortController();
  useChat.setState({ streaming: true, error: null, stream: { text: '', sources: [], reasoning: '' } });

  const assistant: ChatMessage = {
    id: uid(),
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    model: modelId,
    provider: provider as ChatMessage['provider'],
    sources: [],
  };

  try {
    await streamChat(
      payload,
      (ev) => {
        const cur = useChat.getState().stream ?? { text: '', sources: [], reasoning: '' };
        if (ev.type === 'text') {
          useChat.setState({ stream: { ...cur, text: cur.text + (ev.text ?? '') } });
        } else if (ev.type === 'reasoning') {
          useChat.setState({ stream: { ...cur, reasoning: cur.reasoning + (ev.text ?? '') } });
        } else if (ev.type === 'source' && ev.source) {
          if (!cur.sources.some((s) => s.url === ev.source!.url)) {
            useChat.setState({ stream: { ...cur, sources: [...cur.sources, ev.source] } });
          }
        } else if (ev.type === 'error') {
          throw new GatewayError('server', ev.message ?? 'stream error');
        }
      },
      abort.signal,
    );

    const final = useChat.getState().stream;
    assistant.content = final?.text || '';
    assistant.sources = final?.sources ?? [];
    useChat.setState({ streaming: false, stream: null });

    if (temporary) {
      useChat.setState({ messages: [...history, assistant] });
    } else {
      await msgWs.save(chatId, assistant);
      await chatWs.patch(chatId, { updatedAt: Date.now(), messageCount: history.length + 1 });
    }
  } catch (e) {
    const key = errorKey(e);
    assistant.error = key;
    useChat.setState({ streaming: false, stream: null, error: key });
    if (!temporary) await msgWs.save(chatId, assistant).catch(() => undefined);
    useUI.getState().toast(
      settings.lang === 'ar' ? 'تعذّر إكمال الإجابة' : 'Could not complete the response',
      'error',
    );
  } finally {
    abort = null;
  }
}
