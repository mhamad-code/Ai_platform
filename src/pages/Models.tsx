import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useProviders } from '../store/providers';
import { useChat } from '../store/chat';
import { useUI } from '../store/ui';
import { useModelParams } from '../lib/hooks';
import { modelParams as modelParamsWs } from '../lib/workspace';
import { CAP_FILTERS, capTKey, type CapabilityId } from '../ai/capabilities';
import { PROVIDERS, PROVIDER_MAP, type ModelInfo, type ProviderId } from '../ai/types';
import type { ModelParams } from '../lib/db';
import { Badge, Button, Icon, Input, Select, Slider } from '../components/ui';
import { Modal } from '../components/ui/overlays';
import { VendorLogo } from '../components/Logo';
import { PriceText } from '../components/Interactive';
import { cn, formatDate, truncate } from '../lib/utils';

type SortKey = 'price' | 'newest' | 'context' | 'name';
type CapKey = 'vision' | 'files' | 'free' | 'tools' | 'reasoning' | 'imageGen';

export default function ModelsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const models = useProviders((s) => s.models);
  const loading = useProviders((s) => s.loading);
  const health = useProviders((s) => s.health);
  const setOption = useChat((s) => s.setOption);
  const activeModel = useChat((s) => s.model);

  const [q, setQ] = useState('');
  const [provider, setProvider] = useState<string>('all');
  const [caps, setCaps] = useState<Set<CapKey>>(new Set());
  const [sort, setSort] = useState<SortKey>('context');
  const [configuring, setConfiguring] = useState<ModelInfo | null>(null);

  const connected = useMemo(
    () => PROVIDERS.filter((p) => models.some((m) => m.provider === p.id)),
    [models],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = models.filter((m) => {
      if (term && !`${m.name} ${m.id} ${m.company ?? ''}`.toLowerCase().includes(term)) return false;
      if (provider !== 'all' && m.provider !== provider) return false;
      for (const key of caps) {
        if (key === 'free') {
          if (!m.pricing?.free && m.pricing?.input !== 0) return false;
          continue;
        }
        if (!CAP_FILTERS[key]?.some((c) => m.capabilities.includes(c))) return false;
      }
      return true;
    });

    const price = (m: ModelInfo) => m.pricing?.input ?? Number.POSITIVE_INFINITY;
    filtered.sort((a, b) => {
      if (sort === 'price') return price(a) - price(b);
      if (sort === 'context') return (b.contextWindow ?? 0) - (a.contextWindow ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return String(b.releasedAt ?? b.updated_at ?? '').localeCompare(
        String(a.releasedAt ?? a.updated_at ?? ''),
      );
    });
    return filtered;
  }, [models, q, provider, caps, sort]);

  const toggleCap = (k: CapKey) =>
    setCaps((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const CAP_LABELS: Record<CapKey, string> = {
    vision: t('models.filterVision'),
    files: t('models.filterFiles'),
    free: t('models.filterFree'),
    tools: t('models.filterTools'),
    reasoning: t('models.filterReasoning'),
    imageGen: t('models.filterImageGen'),
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('models.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('models.sub')}</p>
        </header>

        {/* controls */}
        <div className="card mb-5 space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('models.searchPlaceholder')}
              wrapClassName="min-w-[14rem] flex-1"
              aria-label={t('models.searchPlaceholder')}
            />
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="h-10 w-auto min-w-[10rem]"
              aria-label={t('models.filterProvider')}
            >
              <option value="all">{t('models.filterProvider')}: {t('common.all')}</option>
              {connected.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 w-auto min-w-[9rem]"
              aria-label={t('common.sort')}
            >
              <option value="context">{t('models.sortContext')}</option>
              <option value="price">{t('models.sortPrice')}</option>
              <option value="newest">{t('models.sortNewest')}</option>
              <option value="name">{t('models.sortName')}</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CAP_LABELS) as CapKey[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleCap(k)}
                aria-pressed={caps.has(k)}
                className={cn(
                  'focusable inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-all',
                  caps.has(k)
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
                )}
              >
                <Icon
                  name={
                    k === 'vision'
                      ? 'eye'
                      : k === 'files'
                        ? 'file'
                        : k === 'free'
                          ? 'sparkles'
                          : k === 'tools'
                            ? 'code'
                            : k === 'reasoning'
                              ? 'layers'
                              : 'image'
                  }
                  className="h-3.5 w-3.5"
                />
                {CAP_LABELS[k]}
              </button>
            ))}
            {(caps.size > 0 || q || provider !== 'all') && (
              <button
                onClick={() => {
                  setCaps(new Set());
                  setQ('');
                  setProvider('all');
                }}
                className="focusable rounded-full px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
              >
                {t('common.clear')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[0.76rem] text-[var(--text-3)]">
            <span>
              {list.length} / {models.length}
            </span>
            {loading && <span className="animate-pulse">{t('common.loading')}</span>}
          </div>
        </div>

        {/* states */}
        {models.length === 0 && (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Icon name="puzzle" className="h-5 w-5" />
            </span>
            <p className="text-[0.92rem] font-bold text-[var(--text)]">
              {health ? t('models.emptyConnected') : t('common.setupRequired')}
            </p>
            <p className="max-w-md text-[0.84rem] text-[var(--text-3)]">
              {health ? t('providers.sub') : t('providers.gatewayRequired')}
            </p>
            <Button variant="primary" onClick={() => navigate('/providers')} icon="puzzle">
              {t('chat.goProviders')}
            </Button>
          </div>
        )}

        {models.length > 0 && list.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <p className="text-[0.9rem] text-[var(--text-3)]">{t('models.empty')}</p>
          </div>
        )}

        {/* grid */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const meta = PROVIDER_MAP[m.provider];
            const selected = activeModel === m.id;
            return (
              <article
                key={m.id}
                className={cn(
                  'card flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]',
                  selected && 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]',
                )}
              >
                <div className="flex items-start gap-3">
                  <VendorLogo
                    name={m.name}
                    slug={meta?.icon ?? m.provider}
                    color={meta?.color ?? '#4C7DFF'}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[0.94rem] font-bold text-[var(--text)]">{m.name}</h3>
                    <p className="truncate text-[0.75rem] text-[var(--text-3)]">
                      {m.company ?? meta?.name ?? m.provider}
                    </p>
                  </div>
                  {selected && <Badge tone="accent">{t('models.selected')}</Badge>}
                  {m.verified && (
                    <span title="verified" className="text-[var(--ok)]">
                      <Icon name="shield" className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {m.description && (
                  <p className="mt-2 line-clamp-2 flex-1 text-[0.8rem] leading-relaxed text-[var(--text-2)]">
                    {lang === 'ar' ? (m.descriptionAr ?? m.description) : m.description}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-[0.74rem]">
                  <span className="rounded-lg bg-[var(--panel-2)] px-2 py-1.5">
                    <b className="text-[var(--text-3)]">{t('models.context')} </b>
                    <span className="font-mono font-semibold text-[var(--text)]">
                      {m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K` : '—'}
                    </span>
                  </span>
                  <span className="rounded-lg bg-[var(--panel-2)] px-2 py-1.5">
                    <b className="text-[var(--text-3)]">{t('models.updated')} </b>
                    <span className="font-semibold text-[var(--text)]">
                      {m.updated_at || m.releasedAt
                        ? formatDate(m.updated_at ?? m.releasedAt ?? 0, lang)
                        : '—'}
                    </span>
                  </span>
                </div>

                <div className="mt-2">
                  <PriceText input={m.pricing?.input} output={m.pricing?.output} free={m.pricing?.free} />
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {m.capabilities.length === 0 ? (
                    <span className="text-[0.72rem] text-[var(--text-3)]">—</span>
                  ) : (
                    m.capabilities.map((c: CapabilityId) => (
                      <Badge key={c} tone="neutral">
                        {t(capTKey(c))}
                      </Badge>
                    ))
                  )}
                </div>

                <div className="mt-3.5 flex gap-2">
                  <Button
                    variant={selected ? 'soft' : 'primary'}
                    size="sm"
                    className="flex-1"
                    icon="send"
                    onClick={() => {
                      setOption('model', m.id);
                      navigate('/chat');
                    }}
                  >
                    {t('models.useInChat')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="sliders"
                    onClick={() => setConfiguring(m)}
                  >
                    {t('models.configure')}
                  </Button>
                </div>

                <p className="mt-2 truncate font-mono text-[0.68rem] text-[var(--text-3)]">{m.id}</p>
              </article>
            );
          })}
        </div>
      </div>

      <ModelSettingsDialog model={configuring} onClose={() => setConfiguring(null)} />
    </div>
  );
}

/* ----------------------- advanced per-model settings --------------------- */

interface ParamDef {
  key: keyof ModelParams;
  label: string;
  aliases: string[];
  kind: 'range' | 'number' | 'text' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
}

const PARAM_DEFS: ParamDef[] = [
  { key: 'temperature', label: 'ms.temperature', aliases: ['temperature'], kind: 'range', min: 0, max: 2, step: 0.05 },
  { key: 'topP', label: 'ms.topP', aliases: ['top_p', 'topP', 'topp'], kind: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'maxTokens', label: 'ms.maxTokens', aliases: ['max_tokens', 'maxTokens', 'max_output_tokens'], kind: 'number' },
  {
    key: 'frequencyPenalty',
    label: 'ms.frequencyPenalty',
    aliases: ['frequency_penalty', 'frequencyPenalty'],
    kind: 'range',
    min: -2,
    max: 2,
    step: 0.1,
  },
  {
    key: 'presencePenalty',
    label: 'ms.presencePenalty',
    aliases: ['presence_penalty', 'presencePenalty'],
    kind: 'range',
    min: -2,
    max: 2,
    step: 0.1,
  },
  { key: 'seed', label: 'ms.seed', aliases: ['seed'], kind: 'number' },
  {
    key: 'reasoningEffort',
    label: 'ms.reasoningEffort',
    aliases: ['reasoning_effort', 'reasoningEffort'],
    kind: 'select',
    options: ['low', 'medium', 'high'],
  },
  {
    key: 'responseFormat',
    label: 'ms.responseFormat',
    aliases: ['response_format', 'responseFormat', 'json_mode'],
    kind: 'select',
    options: ['text', 'json'],
  },
  { key: 'stop', label: 'ms.stop', aliases: ['stop', 'stop_sequences'], kind: 'text', placeholder: 'a,b,c' },
  { key: 'system', label: 'ms.system', aliases: ['system', 'system_prompt'], kind: 'text', placeholder: '' },
];

export function ModelSettingsDialog({ model, onClose }: { model: ModelInfo | null; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useUI((s) => s.toast);
  const saved = useModelParams();
  const [values, setValues] = useState<Partial<ModelParams>>({});

  useEffect(() => {
    if (!model) return;
    const existing = saved.find((p) => p.modelId === model.id);
    setValues(existing ? { ...existing, modelId: undefined } : {});
  }, [model, saved]);

  if (!model) return null;

  const declared = model.parameters.map((p) => p.toLowerCase());
  const supports = (def: ParamDef) =>
    declared.length === 0 ? false : def.aliases.some((a) => declared.includes(a.toLowerCase()));

  const shown = PARAM_DEFS.filter(supports);

  const save = async () => {
    const clean: Omit<ModelParams, 'modelId'> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === '') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clean as any)[k] = v;
    }
    await modelParamsWs.save(model.id, clean);
    toast(t('ms.saved'), 'success');
    onClose();
  };

  const reset = async () => {
    await modelParamsWs.remove(model.id);
    setValues({});
    toast(t('common.reset'), 'info');
  };

  const set = (key: keyof ModelParams, v: unknown) => setValues((s) => ({ ...s, [key]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t('ms.title')} — ${model.name}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => void reset()} icon="refresh">
            {t('common.reset')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()} icon="check">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[0.83rem] leading-relaxed text-[var(--text-2)]">{t('ms.sub')}</p>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-4 py-6 text-center">
          <p className="text-[0.86rem] font-semibold text-[var(--text-3)]">{t('ms.unsupported')}</p>
          <p className="mt-1 font-mono text-[0.74rem] text-[var(--text-3)]">
            {model.parameters.length ? model.parameters.slice(0, 8).join(', ') : t('models.capabilities')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((def) => {
            const raw = values[def.key];
            return (
              <label key={String(def.key)} className="block">
                <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                  {t(def.label as 'ms.temperature')}
                </span>
                {def.kind === 'range' ? (
                  <Slider
                    value={Number(raw ?? (def.key === 'temperature' ? 1 : def.key === 'topP' ? 1 : 0))}
                    min={def.min ?? 0}
                    max={def.max ?? 1}
                    step={def.step ?? 0.1}
                    onChange={(v) => set(def.key, v)}
                    format={(v) => v.toFixed(def.step && def.step < 1 ? 2 : 0)}
                  />
                ) : def.kind === 'number' ? (
                  <input
                    type="number"
                    value={String(raw ?? '')}
                    onChange={(e) => set(def.key, e.target.value === '' ? undefined : Number(e.target.value))}
                    className="focusable w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 text-[0.9rem] text-[var(--text)] focus:border-[var(--accent)]"
                  />
                ) : def.kind === 'select' ? (
                  <Select
                    value={String(raw ?? def.options?.[0] ?? '')}
                    onChange={(e) => set(def.key, e.target.value)}
                  >
                    {def.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={String(raw ?? '')}
                    placeholder={def.placeholder}
                    onChange={(e) => set(def.key, def.key === 'stop' ? e.target.value.split(',').filter(Boolean) : e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[0.76rem] leading-relaxed text-[var(--text-3)]">
        <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {truncate(t('ms.sub'), 160)}
      </p>
    </Modal>
  );
}
