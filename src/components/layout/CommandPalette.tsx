import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../../i18n';
import { useUI } from '../../store/ui';
import { useChat } from '../../store/chat';
import { useProviders } from '../../store/providers';
import { INTEGRATIONS } from '../../integrations/catalog';
import { PROVIDERS } from '../../ai/types';
import { Icon, Kbd } from '../ui';
import { VendorLogo } from '../Logo';
import { truncate } from '../../lib/utils';

type Result = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  group: string;
  run: () => void;
};

const PAGES: { to: string; icon: string; key: TranslationKey }[] = [
  { to: '/', icon: 'sparkles', key: 'nav.home' },
  { to: '/chat', icon: 'layers', key: 'nav.chat' },
  { to: '/providers', icon: 'puzzle', key: 'nav.providers' },
  { to: '/models', icon: 'grid', key: 'nav.models' },
  { to: '/studio', icon: 'image', key: 'nav.images' },
  { to: '/library', icon: 'book', key: 'nav.library' },
  { to: '/projects', icon: 'folder', key: 'nav.projects' },
  { to: '/integrations', icon: 'link', key: 'nav.integrations' },
  { to: '/settings', icon: 'settings', key: 'nav.settings' },
];

export default function CommandPalette() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const chats = useChat((s) => s.chats);
  const selectModel = useChat((s) => s.setOption);
  const models = useProviders((s) => s.models);

  const close = () => useUI.getState().set('paletteOpen', false);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const hit = (s: string) => !q || s.toLowerCase().includes(q);
    const out: Result[] = [];

    for (const p of PAGES) {
      const label = t(p.key);
      if (!hit(label)) continue;
      out.push({
        id: `page:${p.to}`,
        label,
        hint: p.to,
        icon: p.icon,
        group: t('nav.menu'),
        run: () => navigate(p.to),
      });
    }

    if (hit(t('nav.newChat')))
      out.unshift({
        id: 'action:new',
        label: t('nav.newChat'),
        hint: 'Ctrl K',
        icon: 'plus',
        group: t('nav.menu'),
        run: () =>
          void useChat
            .getState()
            .create({ title: lang === 'ar' ? 'محادثة جديدة' : 'New chat' })
            .then((id) => navigate(`/chat/${id}`)),
      });

    for (const c of chats) {
      if (!hit(c.title) && !hit(c.preview ?? '')) continue;
      out.push({
        id: `chat:${c.id}`,
        label: c.title,
        hint: c.preview ?? '',
        icon: 'layers',
        group: t('chat.title'),
        run: () => navigate(`/chat/${c.id}`),
      });
    }

    for (const m of models) {
      if (!hit(m.name) && !hit(m.id)) continue;
      out.push({
        id: `model:${m.id}`,
        label: m.name,
        hint: m.id,
        icon: 'grid',
        group: t('models.title'),
        run: () => {
          selectModel('model', m.id);
          navigate('/chat');
        },
      });
    }

    for (const p of PROVIDERS) {
      if (!hit(p.name)) continue;
      out.push({
        id: `prov:${p.id}`,
        label: p.name,
        hint: p.id,
        icon: 'puzzle',
        group: t('providers.title'),
        run: () => navigate(`/providers/${p.id}`),
      });
    }

    for (const s of INTEGRATIONS) {
      if (!hit(s.name)) continue;
      out.push({
        id: `int:${s.id}`,
        label: s.name,
        hint: s.id,
        icon: 'link',
        group: t('int.title'),
        run: () => navigate('/integrations'),
      });
    }

    return out.slice(0, 40);
  }, [query, chats, models, navigate, selectModel, t, lang]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[cursor];
        if (r) {
          r.run();
          close();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [results, cursor]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-solid)] shadow-[var(--shadow)] animate-slideIn">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
          <Icon name="search" className="h-4 w-4 text-[var(--text-3)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.search')}
            className="h-12 flex-1 bg-transparent text-[0.95rem] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-[0.85rem] text-[var(--text-3)]">{t('int.empty')}</p>
          )}
          {results.map((r, i) => {
            const showGroup = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <div key={r.id}>
                {showGroup && (
                  <div className="px-3 pb-1 pt-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-3)]">
                    {r.group}
                  </div>
                )}
                <button
                  data-idx={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    r.run();
                    close();
                  }}
                  className={
                    'focusable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start ' +
                    (i === cursor ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--border)]')
                  }
                >
                  <span
                    className={
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ' +
                      (i === cursor ? 'text-[var(--accent-text)]' : 'text-[var(--text-3)]')
                    }
                  >
                    <Icon name={r.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.87rem] font-semibold text-[var(--text)]">
                      {truncate(r.label, 56)}
                    </span>
                    {r.hint && (
                      <span className="block truncate text-[0.72rem] text-[var(--text-3)]">
                        {truncate(r.hint, 70)}
                      </span>
                    )}
                  </span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)] rtl:rotate-180" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-2 text-[0.7rem] text-[var(--text-3)]">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {t('common.apply')}
          </span>
          <span className="ms-auto flex items-center gap-1">
            <Kbd>Ctrl</Kbd>+<Kbd>P</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

export { VendorLogo };
