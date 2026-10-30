import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../../i18n';
import { useChat } from '../../store/chat';
import { useUI } from '../../store/ui';
import { useSettings } from '../../store/settings';
import { useProjects } from '../../store/projects';
import { useAuth } from '../../lib/auth';
import { workspace } from '../../lib/workspace';
import { cn, relativeTime, truncate } from '../../lib/utils';
import { BrandLogo } from '../Logo';
import { Icon } from '../ui';
import { ConfirmDialog, Dropdown, MenuItem, Modal } from '../ui/overlays';

interface NavItem {
  to: string;
  icon: string;
  key: TranslationKey;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', icon: 'sparkles', key: 'nav.home', end: true },
  { to: '/chat', icon: 'layers', key: 'nav.chat' },
  { to: '/providers', icon: 'puzzle', key: 'nav.providers' },
  { to: '/models', icon: 'grid', key: 'nav.models' },
  { to: '/studio', icon: 'image', key: 'nav.images' },
  { to: '/library', icon: 'book', key: 'nav.library' },
  { to: '/projects', icon: 'folder', key: 'nav.projects' },
  { to: '/integrations', icon: 'link', key: 'nav.integrations' },
  { to: '/settings', icon: 'settings', key: 'nav.settings' },
];

export default function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { sidebarCollapsed, set } = useUI();
  const settings = useSettings();
  const { user, configured, signOut } = useAuth();

  const chats = useChat((s) => s.chats);
  const activeId = useChat((s) => s.activeId);
  const patchChat = useChat((s) => s.patchChat);
  const removeChat = useChat((s) => s.removeChat);
  const watchChats = useChat((s) => s.watch);

  const projectsList = useProjects((s) => s.projects);
  const watchProjects = useProjects((s) => s.watch);

  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const collapsed = sidebarCollapsed && !mobile;

  useEffect(() => watchChats(), [watchChats]);
  useEffect(() => watchProjects(), [watchProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? chats.filter((c) => c.title.toLowerCase().includes(q) || c.preview?.toLowerCase().includes(q))
      : chats;
    const pinned = pool.filter((c) => c.pinned);
    const rest = pool.filter((c) => !c.pinned);
    const byDay = (list: typeof rest) => {
      const today: typeof rest = [];
      const earlier: typeof rest = [];
      const cut = Date.now() - 86400000;
      for (const c of list) (c.updatedAt >= cut ? today : earlier).push(c);
      return { today, earlier };
    };
    const a = byDay(pinned);
    const b = byDay(rest);
    return { pinned: a.today.concat(a.earlier), today: b.today, earlier: b.earlier };
  }, [chats, query]);

  const toggleTheme = () => settings.set('theme', settings.theme === 'dark' ? 'light' : 'dark');

  const go = (to: string) => {
    navigate(to);
    onClose?.();
  };

  const openChat = (id: string) => {
    navigate(`/chat/${id}`);
    onClose?.();
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-e border-[var(--border)] bg-[var(--panel)] backdrop-blur-xl transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-[16.5rem]',
      )}
    >
      {/* brand + collapse */}
      <div className={cn('flex items-center gap-2 px-3.5 pb-2 pt-3.5', collapsed && 'justify-center px-2')}>
        <BrandLogo compact={collapsed} />
        {!mobile && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('aiplatform.sidebar.collapsed', collapsed ? '0' : '1');
              set('sidebarCollapsed', !collapsed);
            }}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className="focusable ms-auto rounded-lg p-1.5 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="h-4 w-4" />
          </button>
        )}
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="focusable ms-auto rounded-lg p-1.5 text-[var(--text-3)] hover:bg-[var(--border)]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* actions */}
      <div className={cn('grid gap-1.5 px-3 py-2', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={() => go('/chat')}
          className={cn(
            'focusable flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[0.88rem] font-bold text-white shadow-[0_6px_18px_-8px_var(--accent)] transition-all hover:brightness-110',
            collapsed && 'px-0',
          )}
          title={t('nav.newChat')}
        >
          <Icon name="plus" className="h-4 w-4" />
          {!collapsed && t('nav.newChat')}
        </button>

        <button
          type="button"
          onClick={() => useUI.getState().set('paletteOpen', true)}
          className={cn(
            'focusable flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 text-[0.84rem] text-[var(--text-3)] transition-colors hover:border-[var(--border-strong)]',
            collapsed && 'justify-center px-0',
          )}
          title={t('nav.search')}
        >
          <Icon name="search" className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-start">{t('nav.search')}</span>
              <kbd className="rounded border border-[var(--border)] px-1 font-mono text-[0.65rem]">/</kbd>
            </>
          )}
        </button>
      </div>

      {/* navigation */}
      <nav className={cn('grid gap-0.5 px-3 py-1', collapsed && 'px-2')}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            title={t(item.key)}
            className={({ isActive }) =>
              cn(
                'focusable group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[0.86rem] font-semibold transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
              )
            }
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{t(item.key)}</span>}
          </NavLink>
        ))}
      </nav>

      {/* history */}
      <div className={cn('mt-2 flex min-h-0 flex-1 flex-col px-3 pb-2', collapsed && 'px-2')}>
        {!collapsed && (
          <div className="relative mb-1.5">
            <Icon
              name="search"
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-3)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search')}
              className="focusable h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] ps-8 pe-2 text-[0.8rem] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
            />
          </div>
        )}

        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto pe-1">
            {filtered.pinned.length > 0 && <Group label={t('chat.pinned')} />}
            {filtered.pinned.map((c) => (
              <ChatRow
                key={c.id}
                id={c.id}
                title={c.title}
                meta={relativeTime(c.updatedAt, lang)}
                active={activeId === c.id}
                pinned={c.pinned}
                onClick={() => openChat(c.id)}
                onRename={() => setRenaming({ id: c.id, title: c.title })}
                onDelete={() => setDeleting(c.id)}
                onPin={() => patchChat(c.id, { pinned: false })}
                onArchive={() => {
                  patchChat(c.id, { archived: true });
                  useUI.getState().toast(t('chat.archived'), 'success');
                }}
                projects={projectsList.map((p) => ({ id: p.id, name: p.name }))}
                onMove={(pid) => patchChat(c.id, { projectId: pid })}
              />
            ))}
            {filtered.today.length > 0 && <Group label={t('common.today')} />}
            {filtered.today.map((c) => (
              <ChatRow
                key={c.id}
                id={c.id}
                title={c.title}
                meta={relativeTime(c.updatedAt, lang)}
                active={activeId === c.id}
                pinned={c.pinned}
                onClick={() => openChat(c.id)}
                onRename={() => setRenaming({ id: c.id, title: c.title })}
                onDelete={() => setDeleting(c.id)}
                onPin={() => patchChat(c.id, { pinned: true })}
                onArchive={() => patchChat(c.id, { archived: true })}
                projects={projectsList.map((p) => ({ id: p.id, name: p.name }))}
                onMove={(pid) => patchChat(c.id, { projectId: pid })}
              />
            ))}
            {filtered.earlier.length > 0 && <Group label={t('common.older')} />}
            {filtered.earlier.map((c) => (
              <ChatRow
                key={c.id}
                id={c.id}
                title={c.title}
                meta={relativeTime(c.updatedAt, lang)}
                active={activeId === c.id}
                pinned={c.pinned}
                onClick={() => openChat(c.id)}
                onRename={() => setRenaming({ id: c.id, title: c.title })}
                onDelete={() => setDeleting(c.id)}
                onPin={() => patchChat(c.id, { pinned: true })}
                onArchive={() => patchChat(c.id, { archived: true })}
                projects={projectsList.map((p) => ({ id: p.id, name: p.name }))}
                onMove={(pid) => patchChat(c.id, { projectId: pid })}
              />
            ))}
            {chats.length === 0 && (
              <p className="px-2 py-6 text-center text-[0.78rem] leading-relaxed text-[var(--text-3)]">
                {t('chat.noChats')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div className={cn('border-t border-[var(--border)] px-3 py-2.5', collapsed && 'px-2')}>
        {workspace.localOnly && !collapsed && (
          <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[0.7rem] leading-snug text-[var(--text-3)]">
            <b className="text-[var(--warn, #f5a524)]">{t('common.setupRequired')}</b> — {t('auth.setupTitle')}
          </div>
        )}
        <div className={cn('flex items-center gap-1', collapsed && 'justify-center')}>
          <button
            type="button"
            onClick={toggleTheme}
            title={t('settings.theme')}
            className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title={t('settings.language')}
            className="focusable rounded-lg px-2 py-1.5 text-[0.75rem] font-bold text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>

          {!collapsed && (
            <Dropdown
              align="start"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="focusable ms-auto flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--border)]"
                >
                  <Avatar name={user?.name ?? user?.email} url={user?.photoURL} />
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-[0.78rem] font-bold text-[var(--text)]">
                      {user?.name ?? user?.email ?? (configured ? t('common.signIn') : t('common.setupRequired'))}
                    </span>
                    <span className="block truncate text-[0.66rem] text-[var(--text-3)]">
                      {user?.email ?? t('auth.subtitle')}
                    </span>
                  </span>
                  <Icon name="chevronDown" className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon="settings"
                    onClick={() => {
                      close();
                      go('/settings');
                    }}
                  >
                    {t('settings.profile')}
                  </MenuItem>
                  <MenuItem
                    icon="shield"
                    onClick={() => {
                      close();
                      go('/settings');
                    }}
                  >
                    {t('settings.privacy')}
                  </MenuItem>
                  {user && (
                    <MenuItem
                      icon="logout"
                      danger
                      onClick={() => {
                        close();
                        void signOut();
                      }}
                    >
                      {t('common.signOut')}
                    </MenuItem>
                  )}
                  {!user && (
                    <MenuItem
                      icon="user"
                      onClick={() => {
                        close();
                        go('/auth');
                      }}
                    >
                      {t('common.signIn')}
                    </MenuItem>
                  )}
                </>
              )}
            </Dropdown>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={() => go('/settings')}
              className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)]"
              title={t('nav.settings')}
            >
              <Avatar name={user?.name ?? user?.email} url={user?.photoURL} size={26} />
            </button>
          )}
        </div>
      </div>

      {/* rename dialog */}
      <RenameDialog
        state={renaming}
        onCancel={() => setRenaming(null)}
        onSave={(title) => {
          if (renaming) patchChat(renaming.id, { title });
          setRenaming(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title={t('chat.deleteChat')}
        body={t('chat.deleteChat') + '?'}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removeChat(deleting);
          setDeleting(null);
        }}
      />
    </aside>
  );
}

function Group({ label }: { label: string }) {
  return (
    <div className="px-2 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-3)]">
      {label}
    </div>
  );
}

function Avatar({ name, url, size = 30 }: { name?: string | null; url?: string | null; size?: number }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] font-bold text-[var(--accent-text)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

function ChatRow({
  id,
  title,
  meta,
  active,
  pinned,
  onClick,
  onRename,
  onDelete,
  onPin,
  onArchive,
  projects,
  onMove,
}: {
  id: string;
  title: string;
  meta: string;
  active: boolean;
  pinned?: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onPin: () => void;
  onArchive: () => void;
  projects: { id: string; name: string }[];
  onMove: (projectId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg transition-colors',
        active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--border)]',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="focusable flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-start"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            active ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[0.82rem]',
              active ? 'font-bold text-[var(--accent-text)]' : 'font-medium text-[var(--text-2)]',
            )}
          >
            {truncate(title, 42)}
          </span>
          <span className="block truncate text-[0.66rem] text-[var(--text-3)]">{meta}</span>
        </span>
        {pinned && <Icon name="pin" className="h-3 w-3 shrink-0 text-[var(--text-3)]" />}
      </button>

      <Dropdown
        align="end"
        width="w-52"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            aria-label={t('common.more')}
            className={cn(
              'focusable absolute end-1 rounded-md p-1.5 text-[var(--text-3)] hover:bg-[var(--panel-solid)] hover:text-[var(--text)]',
              open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
            )}
          >
            <Icon name="chevronDown" className="h-3.5 w-3.5" />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon="edit"
              onClick={() => {
                close();
                onRename();
              }}
            >
              {t('common.rename')}
            </MenuItem>
            <MenuItem
              icon="pin"
              onClick={() => {
                close();
                onPin();
              }}
            >
              {t('chat.pinChat')}
            </MenuItem>
            <MenuItem
              icon="archive"
              onClick={() => {
                close();
                onArchive();
              }}
            >
              {t('chat.archiveChat')}
            </MenuItem>
            {projects.length > 0 && (
              <div className="my-1 border-y border-[var(--border)] py-1">
                <div className="px-3 py-1 text-[0.68rem] font-bold uppercase text-[var(--text-3)]">
                  {t('chat.moveToProject')}
                </div>
                {projects.slice(0, 5).map((p) => (
                  <MenuItem
                    key={p.id}
                    icon="folder"
                    onClick={() => {
                      close();
                      onMove(p.id);
                    }}
                  >
                    {p.name}
                  </MenuItem>
                ))}
              </div>
            )}
            <MenuItem
              icon="trash"
              danger
              onClick={() => {
                close();
                onDelete();
              }}
            >
              {t('common.delete')}
            </MenuItem>
          </>
        )}
      </Dropdown>
      <span className="sr-only">{id}</span>
    </div>
  );
}

function RenameDialog({
  state,
  onCancel,
  onSave,
}: {
  state: { id: string; title: string } | null;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  useEffect(() => setValue(state?.title ?? ''), [state]);

  return (
    <Modal
      open={Boolean(state)}
      onClose={onCancel}
      title={t('chat.renameChat')}
      size="sm"
      footer={
        <>
          <button
            onClick={onCancel}
            className="focusable rounded-lg px-3 py-2 text-[0.86rem] font-semibold text-[var(--text-2)] hover:bg-[var(--border)]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onSave(value.trim() || state?.title || '')}
            className="focusable rounded-lg bg-[var(--accent)] px-4 py-2 text-[0.86rem] font-bold text-white hover:brightness-110"
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave(value.trim() || state?.title || '')}
        autoFocus
        className="focusable w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-[0.92rem] text-[var(--text)] focus:border-[var(--accent)]"
      />
    </Modal>
  );
}
