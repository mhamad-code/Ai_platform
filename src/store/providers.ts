import { create } from 'zustand';
import { PROVIDERS, PROVIDER_MAP, type ModelInfo, type ProviderConnection, type ProviderId } from '../ai/types';
import { gateway, gatewayEnabled, gatewayHealth, GatewayError } from '../lib/gateway';

interface ProviderState {
  health: boolean;
  loading: boolean;
  status: Record<string, ProviderConnection>;
  models: ModelInfo[];
  error: string | null;
  lastAction: string | null;

  checkHealth: () => Promise<boolean>;
  load: () => Promise<void>;
  saveKey: (provider: ProviderId, key: string) => Promise<void>;
  test: (provider: ProviderId) => Promise<{ ok: boolean; message: string }>;
  remove: (provider: ProviderId) => Promise<void>;
  refreshModels: () => Promise<void>;
}

/** The gateway may return vendor-shaped model objects; normalise them here. */
function normalize(raw: Record<string, unknown>[], fallbackProvider?: string): ModelInfo[] {
  return raw.map((m) => {
    const id = String(m.id ?? m.name ?? '');
    const provider = (String(m.provider ?? fallbackProvider ?? '') || 'openrouter') as ProviderId;
    const caps = Array.isArray(m.capabilities) ? (m.capabilities as string[]) : [];
    const ctx = Number(m.contextWindow ?? m.context_length ?? m.max_input_tokens ?? 0) || undefined;
    const pricing = (m.pricing ?? {}) as Record<string, unknown>;
    const input = typeof pricing.input === 'string' ? Number(pricing.input) : (pricing.input as number);
    const output = typeof pricing.output === 'string' ? Number(pricing.output) : (pricing.output as number);
    return {
      id,
      name: String(m.name ?? m.display_name ?? id),
      provider,
      description: (m.description ?? m.desc) as string | undefined,
      company: (m.company ?? m.owned_by ?? PROVIDER_MAP[provider]?.name) as string | undefined,
      contextWindow: ctx,
      maxOutput: Number(m.maxOutput ?? m.max_output_tokens ?? 0) || undefined,
      releasedAt: (m.releasedAt ?? m.created) as string | undefined,
      updated_at: (m.updatedAt ?? m.updated_at) as string | undefined,
      pricing: {
        input: Number.isFinite(input) ? input : undefined,
        output: Number.isFinite(output) ? output : undefined,
        free: Boolean(m.free ?? pricing.free ?? (input === 0 && output === 0)),
      },
      capabilities: caps as ModelInfo['capabilities'],
      parameters: Array.isArray(m.parameters) ? (m.parameters as string[]) : [],
      verified: Boolean(m.verified),
      available: m.available === undefined ? true : Boolean(m.available),
    } satisfies ModelInfo;
  });
}

export const useProviders = create<ProviderState>()((set, get) => ({
  health: false,
  loading: false,
  status: {},
  models: [],
  error: null,
  lastAction: null,

  checkHealth: async () => {
    const ok = await gatewayHealth();
    set({ health: ok });
    return ok;
  },

  load: async () => {
    if (!gatewayEnabled) {
      set({ health: false, loading: false, models: [], status: {} });
      return;
    }
    set({ loading: true, error: null });
    try {
      const health = await gatewayHealth();
      set({ health });
      if (!health) {
        set({ loading: false, status: {}, models: [] });
        return;
      }
      const status = await gateway.providers.status();
      const mapped: Record<string, ProviderConnection> = {};
      for (const [id, v] of Object.entries(status.connections ?? {})) {
        mapped[id] = {
          provider: id as ProviderId,
          connected: Boolean(v.connected),
          keyHint: v.hint,
          models: v.models,
          lastTest: v.lastTest,
          verified: v.connected,
        };
      }
      set({ status: mapped });
      await get().refreshModels();
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  saveKey: async (provider, key) => {
    set({ lastAction: `key:${provider}` });
    const res = await gateway.providers.saveKey(provider, key);
    set((s) => ({
      status: { ...s.status, [provider]: { provider, connected: true, keyHint: res.hint } },
      lastAction: null,
    }));
    await get().refreshModels();
  },

  test: async (provider) => {
    set({ lastAction: `test:${provider}` });
    try {
      const res = await gateway.providers.test(provider);
      set((s) => ({
        status: {
          ...s.status,
          [provider]: {
            provider,
            connected: res.ok,
            keyHint: s.status[provider]?.keyHint,
            lastTest: { ok: res.ok, at: Date.now(), message: res.message },
            models: res.models,
          },
        },
        lastAction: null,
      }));
      return { ok: res.ok, message: res.message };
    } catch (e) {
      set({ lastAction: null });
      return { ok: false, message: (e as Error).message };
    }
  },

  remove: async (provider) => {
    await gateway.providers.remove(provider);
    set((s) => {
      const next = { ...s.status };
      delete next[provider];
      return { status: next, models: s.models.filter((m) => m.provider !== provider) };
    });
  },

  refreshModels: async () => {
    try {
      const res = await gateway.providers.allModels();
      set({ models: normalize(res.models ?? []), loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: e instanceof GatewayError ? e.message : (e as Error).message });
    }
  },
}));

export function providerConnected(status: Record<string, ProviderConnection>, id: string): boolean {
  return Boolean(status[id]?.connected);
}

export function connectedProviders(status: Record<string, ProviderConnection>): string[] {
  return PROVIDERS.filter((p) => status[p.id]?.connected).map((p) => p.id);
}
