import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../i18n';
import { useChat } from '../store/chat';
import { useProviders } from '../store/providers';
import { useUI } from '../store/ui';
import { useProjects } from '../store/projects';
import { useAuth } from '../lib/auth';
import { workspace } from '../lib/workspace';
import { useFiles, useIntegrationRows, useProviderRows } from '../lib/hooks';
import { INTEGRATIONS } from '../integrations/catalog';
import { PROVIDERS, PROVIDER_MAP } from '../ai/types';
import { BrandMark, VendorLogo } from '../components/Logo';
import { Badge, Icon, SkeletonList } from '../components/ui';
import { cn, formatBytes, relativeTime, truncate } from '../lib/utils';

const SUGGESTIONS: { key: TranslationKey; icon: string }[] = [
  { key: 'home.suggest.writeArticle', icon: 'edit' },
  { key: 'home.suggest.buildWebsite', icon: 'globe' },
  { key: 'home.suggest.analyzePdf', icon: 'file' },
  { key: 'home.suggest.explainImage', icon: 'image' },
  { key: 'home.suggest.writeCode', icon: 'code' },
  { key: 'home.suggest.deepSearch', icon: 'search' },
  { key: 'home.suggest.projectPlan', icon: 'layers' },
  { key: 'home.suggest.compare', icon: 'grid' },
];

export default function HomePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { user, configured } = useAuth();

  const chats = useChat((s) => s.chats);
  const setOption = useChat((s) => s.setOption);
  const model = useChat((s) => s.model);
  const send = useChat((s) => s.send);
  const models = useProviders((s) => s.models);
  const health = useProviders((s) => s.health);
  const projects = useProjects((s) => s.projects);
  const files = useFiles();
  const providerRows = useProviderRows();
  const integrationRows = useIntegrationRows();
  const toast = useUI((s) => s.toast);

  const [query, setQuery] = useState('');

  const connectedCount = PROVIDERS.filter((p) => providerRows.find((r) => r.provider === p.id)?.connected).length;
  const connectedServices = integrationRows.filter((r) => r.status === 'connected').length;

  const topModels = useMemo(
    () => models.slice().sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0)).slice(0, 4),
    [models],
  );

  const popularServices = useMemo(() => INTEGRATIONS.slice(0, 6), []);
  const recentFiles = files.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('home.greetingMorning') : hour < 18 ? t('home.greetingAfternoon') : t('home.greetingEvening');

  const start = async (text: string) => {
    if (!text.trim()) return;
    if (models.length === 0) {
      toast(t('chat.notConfiguredTitle'), 'error');
      navigate('/providers');
      return;
    }
    await send({ text });
    navigate('/chat');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
        {/* ------------------------------ hero ------------------------------ */}
        <section className="text-center">
          <div className="mx-auto mb-4 flex w-fit items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 backdrop-blur-xl">
            <BrandMark size={38} />
            <span className="text-start">
              <span className="block text-[1.05rem] font-extrabold tracking-tight text-[var(--text)]">
                {t('brand')}
              </span>
              <span className="block text-[0.72rem] text-[var(--text-3)]">{t('tagline')}</span>
            </span>
          </div>

          <h1 className="mx-auto max-w-2xl text-[1.75rem] font-extrabold leading-tight tracking-tight text-[var(--text)] sm:text-[2.4rem]">
            {user?.name ? `${greeting}, ${user.name}` : greeting}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[0.95rem] text-[var(--text-2)]">{t('home.whatWouldYouDo')}</p>
        </section>

        {/* --------------------------- smart box --------------------------- */}
        <section className="mx-auto mt-7 max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void start(query);
            }}
            className="card flex items-center gap-2 p-2 ps-4 shadow-[var(--shadow)] focus-within:border-[var(--accent)]"
          >
            <Icon name="search" className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--text-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('home.searchSmart')}
              className="h-10 min-w-0 flex-1 bg-transparent text-[0.95rem] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
            />

            <div className="hidden items-center gap-1.5 border-s border-[var(--border)] ps-2 sm:flex">
              <Icon name="sparkles" className="h-3.5 w-3.5 text-[var(--text-3)]" />
              <select
                value={model ?? models[0]?.id ?? ''}
                onChange={(e) => setOption('model', e.target.value)}
                className="max-w-[10rem] truncate bg-transparent text-[0.8rem] font-semibold text-[var(--text-2)] outline-none"
              >
                {models.length === 0 && <option value="">—</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              aria-label={t('home.send')}
              className="focusable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all hover:brightness-110"
            >
              <Icon name="arrowUp" className="h-4 w-4" />
            </button>
          </form>

          {/* suggestions */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => void start(t(s.key))}
                className="focusable inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[0.8rem] font-medium text-[var(--text-2)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                <Icon name={s.icon} className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                {t(s.key)}
              </button>
            ))}
          </div>

          {/* status strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[0.72rem]">
            <StatusPill ok={health} label={`${t('setup.gateway')}: ${health ? t('setup.ready') : t('setup.missing')}`} />
            <StatusPill
              ok={configured && Boolean(user)}
              label={`${t('setup.firebase')}: ${configured ? (user ? t('setup.ready') : t('common.signIn')) : t('setup.missing')}`}
            />
            <StatusPill ok={connectedCount > 0} label={`${t('providers.title')}: ${connectedCount}/20`} />
            <StatusPill ok={connectedServices > 0} label={`${t('int.title')}: ${connectedServices}/50`} />
          </div>
        </section>

        {/* ------------------------------ grid ------------------------------ */}
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {/* recent chats */}
          <Panel title={t('home.recentChats')} icon="layers" to="/chat" className="lg:col-span-2">
            {chats.length === 0 ? (
              <EmptyBox text={t('chat.noChats')} action={t('nav.newChat')} onAction={() => navigate('/chat')} />
            ) : (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {chats.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/chat/${c.id}`}
                      className="flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--panel-2)]"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.85rem] font-semibold text-[var(--text)]">
                          {truncate(c.title, 44)}
                        </span>
                        <span className="block truncate text-[0.7rem] text-[var(--text-3)]">
                          {relativeTime(c.updatedAt, lang)} · {c.messageCount ?? 0}
                        </span>
                      </span>
                      {c.pinned && <Icon name="pin" className="h-3 w-3 text-[var(--text-3)]" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* quick tasks */}
          <Panel title={t('home.shortcuts')} icon="sparkles">
            <ul className="grid gap-1.5">
              {[
                { icon: 'plus', label: t('nav.newChat'), to: '/chat' },
                { icon: 'image', label: t('nav.images'), to: '/studio' },
                { icon: 'book', label: t('nav.library'), to: '/library' },
                { icon: 'folder', label: t('nav.projects'), to: '/projects' },
                { icon: 'link', label: t('nav.integrations'), to: '/integrations' },
                { icon: 'settings', label: t('nav.settings'), to: '/settings' },
              ].map((s) => (
                <li key={s.to}>
                  <Link
                    to={s.to}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    <Icon name={s.icon} className="h-4 w-4 text-[var(--accent-text)]" />
                    {s.label}
                    <Icon name="chevronRight" className="ms-auto h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          {/* top models */}
          <Panel title={t('home.topModels')} icon="grid" to="/models" className="lg:col-span-2">
            {models.length === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <SkeletonList rows={2} />
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {topModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setOption('model', m.id);
                      navigate('/chat');
                    }}
                    className="focusable group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-start transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
                  >
                    <VendorLogo
                      name={m.name}
                      slug={PROVIDER_MAP[m.provider]?.icon ?? m.provider}
                      color={PROVIDER_MAP[m.provider]?.color ?? '#4C7DFF'}
                      size={34}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.86rem] font-bold text-[var(--text)]">{m.name}</span>
                      <span className="block truncate text-[0.72rem] text-[var(--text-3)]">
                        {PROVIDER_MAP[m.provider]?.name ?? m.provider}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {m.contextWindow && (
                          <Badge tone="neutral">{Math.round(m.contextWindow / 1000)}K ctx</Badge>
                        )}
                        {m.capabilities.slice(0, 2).map((c) => (
                          <Badge key={c} tone="accent">
                            {t(`cap.${c}` as 'cap.text')}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {/* providers */}
          <Panel title={t('home.providers')} icon="puzzle" to="/providers">
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.slice(0, 8).map((p) => {
                const on = providerRows.find((r) => r.provider === p.id)?.connected;
                return (
                  <Link key={p.id} to={`/providers/${p.id}`} title={p.name} className="relative">
                    <VendorLogo name={p.name} slug={p.icon} color={p.color} size={38} />
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2',
                        on ? 'border-[var(--panel-solid)] bg-[var(--ok)]' : 'border-[var(--panel-solid)] bg-[var(--text-3)]',
                      )}
                    />
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 text-[0.76rem] text-[var(--text-3)]">
              {t('providers.sub')}
            </p>
          </Panel>

          {/* services */}
          <Panel title={t('home.services')} icon="link" to="/integrations" className="lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {popularServices.map((s) => (
                <Link
                  key={s.id}
                  to="/integrations"
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
                >
                  <VendorLogo name={s.name} slug={s.icon} color={s.color} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.84rem] font-bold text-[var(--text)]">{s.name}</span>
                    <span className="block truncate text-[0.72rem] text-[var(--text-3)]">
                      {lang === 'ar' ? s.descAr : s.desc}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          {/* projects */}
          <Panel title={t('home.projects')} icon="folder" to="/projects">
            {projects.length === 0 ? (
              <EmptyBox text={t('projects.empty')} action={t('projects.new')} onAction={() => navigate('/projects')} />
            ) : (
              <ul className="grid gap-1.5">
                {projects.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/projects"
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--border)]"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
                        <Icon name="folder" className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.84rem] font-semibold text-[var(--text)]">
                        {p.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* library / files */}
          <Panel title={t('home.library')} icon="book" to="/library">
            {recentFiles.length === 0 ? (
              <EmptyBox text={t('library.empty')} action={t('library.upload')} onAction={() => navigate('/library')} />
            ) : (
              <ul className="grid gap-1.5">
                {recentFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                    <Icon
                      name={f.kind === 'image' ? 'image' : 'file'}
                      className="h-4 w-4 shrink-0 text-[var(--text-3)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.83rem] text-[var(--text)]">{f.name}</span>
                      <span className="block text-[0.7rem] text-[var(--text-3)]">
                        {formatBytes(f.size)} · {relativeTime(f.createdAt, lang)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* images */}
          <Panel title={t('home.images')} icon="image" to="/studio">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Icon name="image" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.85rem] font-bold text-[var(--text)]">{t('images.title')}</p>
                <p className="text-[0.75rem] leading-snug text-[var(--text-3)]">{t('images.sub')}</p>
              </div>
            </div>
          </Panel>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[0.75rem] text-[var(--text-3)]">
          <span>{t('tagline')}</span>
          <Link to="/privacy" className="hover:text-[var(--text-2)] hover:underline">
            {t('legal.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-[var(--text-2)] hover:underline">
            {t('legal.terms')}
          </Link>
          <Link to="/cookies" className="hover:text-[var(--text-2)] hover:underline">
            {t('legal.cookies')}
          </Link>
          {workspace.localOnly && <span>· {t('common.setupRequired')}</span>}
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Panel({
  title,
  icon,
  to,
  children,
  className,
}: {
  title: string;
  icon: string;
  to?: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <section className={cn('card p-4', className)}>
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <h2 className="flex-1 text-[0.9rem] font-bold text-[var(--text)]">{title}</h2>
        {to && (
          <Link
            to={to}
            className="text-[0.75rem] font-semibold text-[var(--accent-text)] hover:underline"
          >
            {t('home.viewAll')}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-xl',
        ok
          ? 'border-[color-mix(in_srgb,var(--ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[var(--ok)]'
          : 'border-[var(--border)] bg-[var(--panel)] text-[var(--text-3)]',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-[var(--ok)]' : 'bg-[var(--text-3)]')} />
      {label}
    </span>
  );
}

function EmptyBox({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-6 text-center">
      <p className="text-[0.82rem] text-[var(--text-3)]">{text}</p>
      <button
        onClick={onAction}
        className="focusable rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-[0.8rem] font-bold text-[var(--accent-text)] hover:brightness-110"
      >
        {action}
      </button>
    </div>
  );
}
