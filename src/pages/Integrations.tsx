import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useUI } from '../store/ui';
import { useProviders } from '../store/providers';
import { useIntegrationRows } from '../lib/hooks';
import { gateway, GatewayError } from '../lib/gateway';
import { integrations as integrationsWs } from '../lib/workspace';
import {
  CATEGORIES,
  INTEGRATIONS,
  type IntegrationService,
} from '../integrations/catalog';
import { Badge, Button, Icon, Input } from '../components/ui';
import { Modal } from '../components/ui/overlays';
import { VendorLogo } from '../components/Logo';
import { cn, relativeTime } from '../lib/utils';

type StatusMap = Record<string, { status: string; account?: string; scopes?: string[]; verified?: boolean }>;

export default function IntegrationsPage() {
  const { t, lang } = useI18n();
  const toast = useUI((s) => s.toast);
  const health = useProviders((s) => s.health);

  const rows = useIntegrationRows();
  const [remote, setRemote] = useState<StatusMap>({});
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [active, setActive] = useState<IntegrationService | null>(null);
  const [tokenFor, setTokenFor] = useState<IntegrationService | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!health) return;
    let alive = true;
    gateway.integrations
      .status()
      .then((r) => alive && setRemote(r.connections ?? {}))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [health]);

  const statusOf = (id: string) => {
    const local = rows.find((r) => r.id === id);
    const rmt = remote[id];
    if (rmt) return rmt;
    if (local) return { status: local.status, account: local.account, scopes: local.scopes, verified: local.verified };
    return { status: 'disconnected' };
  };

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return INTEGRATIONS.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (!term) return true;
      return `${s.name} ${s.desc} ${s.descAr} ${s.category}`.toLowerCase().includes(term);
    });
  }, [q, category]);

  const connect = async (svc: IntegrationService) => {
    if (svc.auth === 'manual') {
      setActive(svc);
      return;
    }
    if (svc.auth === 'token') {
      setTokenFor(svc);
      setToken('');
      return;
    }
    if (!health) {
      toast(t('int.gatewayNeeded'), 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await gateway.integrations.start(svc.id);
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast(e instanceof GatewayError ? e.message : (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitToken = async () => {
    if (!tokenFor || !token.trim()) return;
    setBusy(true);
    try {
      const res = await gateway.integrations.saveToken(tokenFor.id, token.trim());
      await integrationsWs.save(tokenFor.id, {
        status: 'connected',
        account: res.account,
        verified: res.verified ?? false,
        updatedAt: Date.now(),
        provider: tokenFor.id,
      });
      setRemote((s) => ({
        ...s,
        [tokenFor.id]: { status: 'connected', account: res.account, verified: res.verified ?? false },
      }));
      toast(t('common.connected'), 'success');
      setTokenFor(null);
      setToken('');
    } catch (e) {
      toast(e instanceof GatewayError ? e.message : (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (svc: IntegrationService) => {
    try {
      if (health) await gateway.integrations.disconnect(svc.id);
      await integrationsWs.remove(svc.id);
      setRemote((s) => {
        const n = { ...s };
        delete n[svc.id];
        return n;
      });
      toast(t('common.disconnect'), 'success');
    } catch (e) {
      toast(e instanceof GatewayError ? e.message : (e as Error).message, 'error');
    }
    setActive(null);
  };

  const connectedCount = INTEGRATIONS.filter((s) => statusOf(s.id).status === 'connected').length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('int.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('int.sub')}</p>
        </header>

        {!health && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-3.5">
            <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a524]" />
            <div className="text-[0.84rem] leading-relaxed text-[var(--text-2)]">
              <b className="text-[var(--text)]">{t('common.setupRequired')}</b> — {t('int.gatewayNeeded')}
            </div>
          </div>
        )}

        {/* controls */}
        <div className="card mb-4 space-y-3 p-3.5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('int.searchPlaceholder')}
            wrapClassName="w-full"
          />
          <div className="flex flex-wrap gap-1.5">
            <CatPill active={category === 'all'} onClick={() => setCategory('all')} label={`${t('common.all')} · ${INTEGRATIONS.length}`} />
            {CATEGORIES.map((c) => (
              <CatPill
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                label={`${t(c.key)} · ${INTEGRATIONS.filter((s) => s.category === c.id).length}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-[0.76rem] text-[var(--text-3)]">
            <span>
              {list.length} / {INTEGRATIONS.length}
            </span>
            <span>·</span>
            <span className="text-[var(--ok)]">{connectedCount} {t('common.connected')}</span>
          </div>
        </div>

        {list.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <p className="text-[0.9rem] text-[var(--text-3)]">{t('int.empty')}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((svc) => {
            const st = statusOf(svc.id);
            const on = st.status === 'connected';
            return (
              <article
                key={svc.id}
                className="card flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              >
                <div className="flex items-start gap-3">
                  <VendorLogo name={svc.name} slug={svc.icon} color={svc.color} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-[0.92rem] font-bold text-[var(--text)]">{svc.name}</h3>
                      {on && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--ok)]"
                          title={t('common.connected')}
                        />
                      )}
                    </div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                      {t(CATEGORIES.find((c) => c.id === svc.category)?.key ?? 'cat.git')}
                    </p>
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 flex-1 text-[0.81rem] leading-relaxed text-[var(--text-2)]">
                  {lang === 'ar' ? svc.descAr : svc.desc}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  <Badge tone={svc.auth === 'oauth' ? 'accent' : svc.auth === 'token' ? 'neutral' : 'warn'}>
                    {svc.auth === 'oauth'
                      ? t('int.oauth')
                      : svc.auth === 'token'
                        ? t('int.token')
                        : t('int.manualSetup')}
                  </Badge>
                  {st.account && <Badge tone="ok">{st.account}</Badge>}
                  {on && st.verified === false && <Badge tone="warn">{t('int.notVerified')}</Badge>}
                </div>

                <div className="mt-3 flex gap-2">
                  {on ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        icon="sliders"
                        onClick={() => setActive(svc)}
                      >
                        {t('common.manage')}
                      </Button>
                      <Button variant="ghost" size="sm" icon="x" onClick={() => void disconnect(svc)}>
                        {t('common.disconnect')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      icon="link"
                      loading={busy}
                      onClick={() => void connect(svc)}
                    >
                      {t('common.connect')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* manage dialog */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? t('int.flowTitle', { name: active.name }) : ''}
        size="lg"
        footer={
          active && (
            <>
              <Button variant="ghost" onClick={() => setActive(null)}>
                {t('common.close')}
              </Button>
              <Button variant="danger" icon="x" onClick={() => void disconnect(active)}>
                {t('common.disconnect')}
              </Button>
            </>
          )
        }
      >
        {active && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <VendorLogo name={active.name} slug={active.icon} color={active.color} size={44} />
              <div className="min-w-0">
                <p className="text-[0.9rem] font-bold text-[var(--text)]">{active.name}</p>
                <p className="text-[0.78rem] text-[var(--text-3)]">
                  {t('int.category')}: {t(CATEGORIES.find((c) => c.id === active.category)?.key ?? 'cat.git')}
                </p>
              </div>
              <span className="ms-auto">
                <Badge tone={statusOf(active.id).status === 'connected' ? 'ok' : 'neutral'}>
                  {statusOf(active.id).status}
                </Badge>
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
              <h4 className="mb-1.5 text-[0.85rem] font-bold text-[var(--text)]">
                {active.auth === 'manual' ? t('int.manualSetup') : t('int.flowWhatHappens')}
              </h4>
              {active.auth === 'manual' ? (
                <ol className="list-decimal space-y-1.5 ps-5 text-[0.83rem] leading-relaxed text-[var(--text-2)]">
                  {(active.setup ?? []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  {(active.setup ?? []).length === 0 && <li>{t('int.manualBody', { name: active.name })}</li>}
                </ol>
              ) : (
                <ol className="list-decimal space-y-1.5 ps-5 text-[0.83rem] leading-relaxed text-[var(--text-2)]">
                  <li>{t('int.flowStep1', { name: active.name })}</li>
                  <li>{t('int.flowStep2')}</li>
                  <li>{t('int.flowStep3')}</li>
                </ol>
              )}
            </div>

            {active.scopes && active.scopes.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[0.85rem] font-bold text-[var(--text)]">{t('int.permissions')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {active.scopes.map((s) => (
                    <Badge key={s} tone="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-1.5 text-[0.85rem] font-bold text-[var(--text)]">{t('int.capabilities')}</h4>
              <ul className="grid gap-1.5">
                {active.tools.map((tool) => (
                  <li
                    key={tool.id}
                    className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2"
                  >
                    <Icon
                      name={tool.sensitive ? 'shield' : 'terminal'}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]"
                    />
                    <span className="min-w-0 flex-1 text-[0.82rem] text-[var(--text-2)]">
                      <b className="font-mono text-[0.78rem] text-[var(--text)]">{tool.id}</b> —{' '}
                      {lang === 'ar' ? tool.descAr : tool.desc}
                    </span>
                    {tool.sensitive && <Badge tone="warn">{t('common.confirm')}</Badge>}
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={active.docs}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--accent-text)] hover:underline"
            >
              {t('providers.docs')} <Icon name="external" className="h-3 w-3" />
            </a>

            {statusOf(active.id).status === 'connected' && rows.find((r) => r.id === active.id) && (
              <p className="text-[0.75rem] text-[var(--text-3)]">
                {relativeTime(rows.find((r) => r.id === active.id)!.updatedAt, lang)}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* token dialog */}
      <Modal
        open={Boolean(tokenFor)}
        onClose={() => setTokenFor(null)}
        title={tokenFor ? t('int.flowTitle', { name: tokenFor.name }) : ''}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTokenFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={busy} disabled={!token.trim()} onClick={() => void submitToken()}>
              {t('common.connect')}
            </Button>
          </>
        }
      >
        {tokenFor && (
          <div className="space-y-3">
            <p className="text-[0.85rem] leading-relaxed text-[var(--text-2)]">
              {t('int.manualBody', { name: tokenFor.name })}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                {tokenFor.tokenLabel ?? t('int.token')}
              </span>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={tokenFor.tokenLabel ?? t('int.token')}
              />
            </label>
            <ol className="list-decimal space-y-1.5 ps-5 text-[0.83rem] leading-relaxed text-[var(--text-2)]">
              <li>{t('int.flowStep1', { name: tokenFor.name })}</li>
              <li>{t('int.flowStep2')}</li>
              <li>{t('int.flowStep3')}</li>
            </ol>
            <a
              href={tokenFor.docs}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--accent-text)] hover:underline"
            >
              {t('providers.docs')} <Icon name="external" className="h-3 w-3" />
            </a>
            {!health && (
              <p className="rounded-lg border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_10%,transparent)] px-3 py-2 text-[0.78rem] text-[var(--text-2)]">
                {t('int.gatewayNeeded')}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CatPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'focusable rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold transition-all',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
          : 'border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
      )}
    >
      {label}
    </button>
  );
}
