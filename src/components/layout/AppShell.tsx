import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Background from '../Background';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import { BrandLogo } from '../Logo';
import { Icon } from '../ui';
import { ToastHost } from '../ui/overlays';
import { useUI } from '../../store/ui';
import { useSettings, applySettings } from '../../store/settings';
import { useChat } from '../../store/chat';
import { useProviders } from '../../store/providers';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';

export default function AppShell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, set } = useUI();
  const settings = useSettings();
  const paletteOpen = useUI((s) => s.paletteOpen);
  const createChat = useChat((s) => s.create);
  const loadProviders = useProviders((s) => s.load);
  const [drawerReady, setDrawerReady] = useState(false);

  // Preferences → document
  useEffect(() => applySettings(settings), [settings]);

  // Providers/models are fetched once for the whole app
  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    set('sidebarOpen', false);
  }, [location.pathname, set]);

  // Drawer mount/animation
  useEffect(() => {
    if (sidebarOpen) {
      setDrawerReady(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const id = setTimeout(() => setDrawerReady(false), 200);
      return () => clearTimeout(id);
    }
    return () => undefined;
  }, [sidebarOpen]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if (mod && (e.key === '/' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        useUI.getState().set('paletteOpen', true);
        return;
      }
      if (e.key === 'Escape') {
        if (useUI.getState().paletteOpen) useUI.getState().set('paletteOpen', false);
        else if (useUI.getState().sidebarOpen) useUI.getState().set('sidebarOpen', false);
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        void useChat.getState().create({ title: 'New chat' }).then((id) => navigate(`/chat/${id}`));
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const s = useSettings.getState();
        s.set('theme', s.theme === 'dark' ? 'light' : 'dark');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Background
        variant={settings.background}
        animate={settings.backgroundAnim && settings.motion}
        light={settings.theme === 'light'}
        reduced={!settings.motion}
      />

      <div className="relative z-10 flex h-full min-h-0">
        {/* desktop sidebar */}
        <div className="hidden h-full lg:block">
          <Sidebar />
        </div>

        {/* mobile drawer */}
        {drawerReady && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className={cn(
                'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
                sidebarOpen ? 'opacity-100' : 'opacity-0',
              )}
              onClick={() => set('sidebarOpen', false)}
            />
            <div
              className={cn(
                'absolute inset-y-0 h-full w-[86%] max-w-[19rem] shadow-2xl transition-transform duration-200',
                sidebarOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
              )}
              style={{ insetInlineStart: 0 }}
            >
              <Sidebar mobile onClose={() => set('sidebarOpen', false)} />
            </div>
          </div>
        )}

        {/* content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile top bar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 backdrop-blur-xl lg:hidden">
            <button
              type="button"
              onClick={() => set('sidebarOpen', true)}
              aria-label={t('nav.menu')}
              className="focusable rounded-lg p-2 text-[var(--text-2)] hover:bg-[var(--border)]"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <BrandLogo />
            <button
              type="button"
              onClick={() => settings.set('theme', settings.theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('settings.theme')}
              className="focusable ms-auto rounded-lg p-2 text-[var(--text-2)] hover:bg-[var(--border)]"
            >
              <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" />
            </button>
          </header>

          <main className="app-main relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>

      {paletteOpen && <CommandPalette />}
      <ToastHost />
      <CookieConsent />
    </div>
  );
}

/* ----------------------------- cookie consent ---------------------------- */

const COOKIE_KEY = 'aiplatform.cookies';

export function CookieConsent() {
  const { t } = useI18n();
  const [choice, setChoice] = useState<string | null>(() => localStorage.getItem(COOKIE_KEY));
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const decide = (value: 'accepted' | 'rejected') => {
    localStorage.setItem(COOKIE_KEY, value);
    setChoice(value);
  };

  if (choice) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--panel-solid)] p-4 shadow-[var(--shadow)] animate-slideIn">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Icon name="shield" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.92rem] font-bold text-[var(--text)]">{t('cookie.title')}</h3>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-[var(--text-2)]">{t('cookie.body')}</p>

            {manage && (
              <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked disabled className="mt-1 accent-[var(--accent)]" />
                  <span className="text-[0.8rem]">
                    <b className="text-[var(--text)]">Necessary</b>
                    <span className="block text-[var(--text-3)]">Session, sign-in and security.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="text-[0.8rem]">
                    <b className="text-[var(--text)]">Analytics</b>
                    <span className="block text-[var(--text-3)]">
                      Anonymous usage statistics. Off by default.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setManage((v) => !v)}
            className="focusable rounded-lg px-3 py-2 text-[0.82rem] font-semibold text-[var(--text-2)] hover:bg-[var(--border)]"
          >
            {t('cookie.manage')}
          </button>
          <button
            onClick={() => decide('rejected')}
            className="focusable rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-[0.82rem] font-semibold text-[var(--text)] hover:bg-[var(--border)]"
          >
            {t('cookie.reject')}
          </button>
          <button
            onClick={() => decide('accepted')}
            className="focusable rounded-lg bg-[var(--accent)] px-4 py-2 text-[0.82rem] font-bold text-white hover:brightness-110"
          >
            {t('cookie.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
