import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useProviders } from '../store/providers';
import { useProviderRows } from '../lib/hooks';
import { PROVIDERS, PROVIDER_MAP, type ProviderId } from '../ai/types';
import { Badge, Button, Icon, Input } from '../components/ui';
import { VendorLogo } from '../components/Logo';
import { cn, truncate } from '../lib/utils';

/* ------------------------------- list page ------------------------------- */

export function ProvidersPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all');

  const rows = useProviderRows();
  const health = useProviders((s) => s.health);
  const loading = useProviders((s) => s.loading);
  const models = useProviders((s) => s.models);

  const connected = rows.filter((r) => r.connected).map((r) => r.provider);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PROVIDERS.filter((p) => {
      if (term && !`${p.name} ${p.desc} ${p.id}`.toLowerCase().includes(term)) return false;
      const on = connected.includes(p.id);
      if (filter === 'on') return on;
      if (filter === 'off') return !on;
      return true;
    });
  }, [q, filter, connected]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('providers.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('providers.sub')}</p>
        </header>

        {!health && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-3.5">
            <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a524]" />
            <div className="text-[0.84rem] leading-relaxed text-[var(--text-2)]">
              <b className="text-[var(--text)]">{t('common.setupRequired')}</b> — {t('providers.gatewayRequired')}
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('providers.searchPlaceholder')}
            wrapClassName="flex-1 min-w-[14rem]"
            className="h-10"
            aria-label={t('common.search')}
          />
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
            {(
              [
                ['all', t('providers.filterAll')],
                ['on', t('providers.filterConnected')],
                ['off', t('providers.filterNotConnected')],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn(
                  'focusable rounded-lg px-3 py-1.5 text-[0.8rem] font-semibold transition-colors',
                  filter === k
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[0.78rem] text-[var(--text-3)]">
            {connected.length}/{PROVIDERS.length}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const row = rows.find((r) => r.provider === p.id);
            const on = Boolean(row?.connected);
            const count = models.filter((m) => m.provider === p.id).length;
            return (
              <article
                key={p.id}
                className="card group flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => navigate(`/providers/${p.id}`)}
                    className="focusable rounded-xl"
                    aria-label={p.name}
                  >
                    <VendorLogo name={p.name} slug={p.icon} color={p.color} size={44} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate(`/providers/${p.id}`)}
                      className="focusable block max-w-full truncate text-start text-[0.95rem] font-bold text-[var(--text)] hover:text-[var(--accent-text)]"
                    >
                      {p.name}
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold',
                          on
                            ? 'bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-[var(--ok)]'
                            : 'bg-[var(--border)] text-[var(--text-3)]',
                        )}
                      >
                        <span
                          className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-[var(--ok)]' : 'bg-[var(--text-3)]')}
                        />
                        {on ? t('common.connected') : t('common.notConnected')}
                      </span>
                      <span className="text-[0.7rem] text-[var(--text-3)]">
                        {count > 0 ? `${count} ${t('providers.modelsCount')}` : p.auth === 'oauth' ? t('int.oauth') : 'API'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 flex-1 text-[0.82rem] leading-relaxed text-[var(--text-2)]">
                  {lang === 'ar' ? p.descAr : p.desc}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant={on ? 'soft' : 'primary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/providers/${p.id}`)}
                    icon={on ? 'settings' : 'plus'}
                  >
                    {on ? t('common.manage') : t('common.connect')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/providers/${p.id}`)}
                    aria-label={t('common.manage')}
                  >
                    <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>

                {row?.lastTest && (
                  <p
                    className={cn(
                      'mt-2 text-[0.72rem]',
                      row.lastTest.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]',
                    )}
                  >
                    {row.lastTest.ok ? t('providers.testOk') : t('providers.testFail')} —{' '}
                    {truncate(row.lastTest.message ?? '', 80)}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {list.length === 0 && (
          <p className="py-12 text-center text-[0.9rem] text-[var(--text-3)]">{t('models.empty')}</p>
        )}

        <p className="mt-6 text-center text-[0.78rem] text-[var(--text-3)]">
          <Link to="/models" className="text-[var(--accent-text)] hover:underline">
            {t('models.title')}
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- detail page ------------------------------- */

export function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const provider = PROVIDER_MAP[id ?? ''] ?? null;

  const rows = useProviderRows();
  const health = useProviders((s) => s.health);
  const models = useProviders((s) => s.models);
  const lastAction = useProviders((s) => s.lastAction);
  const saveKey = useProviders((s) => s.saveKey);
  const test = useProviders((s) => s.test);
  const remove = useProviders((s) => s.remove);
  const refresh = useProviders((s) => s.refreshModels);

  const [key, setKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'remove'>('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tab, setTab] = useState<'info' | 'connect' | 'models'>('connect');

  if (!provider)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--text-3)]">{t('error.notFound')}</p>
        <Link to="/providers" className="text-[var(--accent-text)] hover:underline">
          {t('providers.title')}
        </Link>
      </div>
    );

  const row = rows.find((r) => r.provider === provider.id);
  const on = Boolean(row?.connected);
  const providerModels = models.filter((m) => m.provider === provider.id);

  const doSave = async () => {
    if (!key.trim()) return;
    setBusy('save');
    setResult(null);
    try {
      await saveKey(provider.id as ProviderId, key.trim());
      setKey('');
      setResult({ ok: true, message: t('providers.keySaved') });
      const res = await test(provider.id as ProviderId);
      setResult(res);
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setBusy('');
    }
  };

  const doTest = async () => {
    setBusy('test');
    setResult(null);
    setResult(await test(provider.id as ProviderId));
    setBusy('');
  };

  const doRemove = async () => {
    setBusy('remove');
    await remove(provider.id as ProviderId);
    setResult(null);
    setBusy('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-14 pt-6 sm:px-6">
        <Link
          to="/providers"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
        >
          <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /> {t('providers.title')}
        </Link>

        <header className="card mb-5 flex flex-wrap items-center gap-4 p-5">
          <VendorLogo name={provider.name} slug={provider.icon} color={provider.color} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.35rem] font-extrabold tracking-tight text-[var(--text)]">{provider.name}</h1>
            <p className="mt-1 text-[0.87rem] leading-relaxed text-[var(--text-2)]">
              {lang === 'ar' ? provider.descAr : provider.desc}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={on ? 'ok' : 'neutral'}>
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-[var(--ok)]' : 'bg-[var(--text-3)]')}
                />
                {on ? t('common.connected') : t('common.notConnected')}
              </Badge>
              <Badge tone="neutral">{providerModels.length} {t('providers.modelsCount')}</Badge>
              {provider.auth === 'oauth' && <Badge tone="accent">{t('int.oauth')}</Badge>}
              {!health && <Badge tone="warn">{t('common.setupRequired')}</Badge>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={provider.website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--accent-text)] hover:underline"
            >
              {(() => {
                try {
                  return new URL(provider.website).hostname;
                } catch {
                  return provider.name;
                }
              })()}{' '}
              <Icon name="external" className="h-3 w-3" />
            </a>
            <a
              href={provider.docs}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--accent-text)] hover:underline"
            >
              {t('providers.docs')} <Icon name="external" className="h-3 w-3" />
            </a>
          </div>
        </header>

        {/* tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
          {(
            [
              ['connect', t('providers.detailConnect')],
              ['info', t('providers.detailInfo')],
              ['models', t('providers.detailModels')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'focusable whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.84rem] font-semibold transition-colors',
                tab === k
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'connect' && (
          <section className="card p-5">
            <h2 className="text-[1rem] font-bold text-[var(--text)]">{t('providers.addKey')}</h2>
            <p className="mt-1 text-[0.85rem] leading-relaxed text-[var(--text-2)]">
              {lang === 'ar'
                ? `أدخل مفتاح الـ API الخاص بـ ${provider.name}. يُخزَّن على الخادم مشفَّراً ولا يظهر بعد الحفظ.`
                : `Enter your ${provider.name} API key. It is stored encrypted on the server and never shown again.`}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <label className="mb-1.5 block text-[0.8rem] font-semibold text-[var(--text-2)]">
                  {provider.keyLabel}
                </label>
                <div className="relative">
                  <Input
                    type={reveal ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={provider.keyLabel}
                    autoComplete="off"
                    spellCheck={false}
                    wrapClassName="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? 'hide' : 'show'}
                    className="focusable absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-3)] hover:text-[var(--text)]"
                  >
                    <Icon name={reveal ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Button variant="primary" loading={busy === 'save'} disabled={!key.trim()} onClick={() => void doSave()}>
                {t('common.save')}
              </Button>
              <Button variant="outline" loading={busy === 'test'} onClick={() => void doTest()}>
                {busy === 'test' ? t('common.testing') : t('common.test')}
              </Button>
              {on && (
                <Button variant="danger" loading={busy === 'remove'} onClick={() => void doRemove()}>
                  {t('common.disconnect')}
                </Button>
              )}
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-[0.76rem] text-[var(--text-3)]">
              <Icon name="shield" className="h-3.5 w-3.5" /> {t('providers.keyHidden')}
            </p>

            {result && (
              <p
                className={cn(
                  'mt-3 rounded-lg border px-3 py-2 text-[0.84rem]',
                  result.ok
                    ? 'border-[color-mix(in_srgb,var(--ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-[var(--ok)]'
                    : 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]',
                )}
              >
                {result.message}
              </p>
            )}

            {row?.keyHint && (
              <p className="mt-3 text-[0.8rem] text-[var(--text-3)]">
                <b>{t('providers.baseUrl')}:</b> <code className="font-mono">{row.keyHint}</code>
              </p>
            )}
          </section>
        )}

        {tab === 'info' && (
          <section className="card space-y-4 p-5">
            <div>
              <h3 className="text-[0.9rem] font-bold text-[var(--text)]">{t('providers.detailInfo')}</h3>
              <p className="mt-1 text-[0.85rem] text-[var(--text-2)]">
                {lang === 'ar' ? provider.descAr : provider.desc}
              </p>
            </div>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {[
                [t('providers.baseUrl'), provider.website],
                [t('common.status'), on ? t('common.connected') : t('common.notConnected')],
                [t('providers.docs'), provider.docs],
                [t('common.name'), provider.keyLabel],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
                  <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-3)]">{k}</dt>
                  <dd className="mt-0.5 break-all text-[0.84rem] text-[var(--text)]">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h4 className="mb-2 text-[0.85rem] font-bold text-[var(--text)]">{t('providers.detailInfo')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(provider.features)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <Badge key={k} tone="accent">
                      {k}
                    </Badge>
                  ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'models' && (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[0.95rem] font-bold text-[var(--text)]">
                {t('models.title')} ({providerModels.length})
              </h3>
              <Button size="sm" variant="outline" onClick={() => void refresh()} icon="refresh">
                {t('common.retry')}
              </Button>
            </div>

            {providerModels.length === 0 ? (
              <p className="py-8 text-center text-[0.85rem] text-[var(--text-3)]">
                {health ? t('models.emptyConnected') : t('providers.gatewayRequired')}
              </p>
            ) : (
              <ul className="grid gap-2">
                {providerModels.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.88rem] font-bold text-[var(--text)]">{m.name}</div>
                      <div className="truncate font-mono text-[0.72rem] text-[var(--text-3)]">{m.id}</div>
                    </div>
                    {m.contextWindow && <Badge tone="neutral">{Math.round(m.contextWindow / 1000)}K</Badge>}
                    <Link
                      to="/models"
                      className="text-[0.78rem] font-semibold text-[var(--accent-text)] hover:underline"
                    >
                      {t('models.configure')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {lastAction && <p className="mt-3 text-center text-[0.78rem] text-[var(--text-3)]">{t('common.loading')}</p>}
      </div>
    </div>
  );
}
