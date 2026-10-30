import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../i18n';
import { AuthError, useAuth } from '../lib/auth';
import { BrandMark } from '../components/Logo';
import { Button, Icon, Input } from '../components/ui';
import Background from '../components/Background';
import { useSettings } from '../store/settings';
import { cn } from '../lib/utils';

type Mode = 'signin' | 'signup' | 'reset';

export default function AuthPage({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const settings = useSettings();
  const { signIn, signUp, signInWithGoogle, resetPassword, configured, loading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const titleKey: TranslationKey =
    mode === 'signup' ? 'auth.createAccount' : mode === 'reset' ? 'auth.reset' : 'auth.welcome';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof AuthError ? t(e.key as TranslationKey) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      void run(async () => {
        await resetPassword(email.trim());
        setNotice(t('auth.resetSent'));
      });
      return;
    }
    if (mode === 'signup') {
      if (password !== confirm) {
        setError(t('auth.confirmPassword'));
        return;
      }
      if (!agree) {
        setError(t('auth.terms'));
        return;
      }
      void run(async () => {
        await signUp(name.trim() || email.split('@')[0], email.trim(), password);
        navigate('/');
      });
      return;
    }
    void run(async () => {
      await signIn(email.trim(), password);
      navigate('/');
    });
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-y-auto">
      <Background
        variant={settings.background}
        animate={settings.backgroundAnim && settings.motion}
        light={settings.theme === 'light'}
        reduced={!settings.motion}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Link to="/" className="mb-5 flex items-center justify-center gap-3">
          <BrandMark size={44} />
          <span className="text-start">
            <span className="block text-[1.1rem] font-extrabold tracking-tight text-[var(--text)]">{t('brand')}</span>
            <span className="block text-[0.72rem] text-[var(--text-3)]">{t('tagline')}</span>
          </span>
        </Link>

        <div className="card p-6 shadow-[var(--shadow)] sm:p-7">
          <h1 className="text-center text-[1.3rem] font-extrabold tracking-tight text-[var(--text)]">
            {t(titleKey)}
          </h1>
          <p className="mt-1 text-center text-[0.84rem] text-[var(--text-3)]">{t('auth.subtitle')}</p>

          {!configured && (
            <div className="mt-4 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-3">
              <div className="flex items-center gap-2 text-[0.84rem] font-bold text-[var(--text)]">
                <Icon name="warn" className="h-4 w-4 text-[#f5a524]" /> {t('auth.setupTitle')}
              </div>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-[var(--text-2)]">{t('auth.setupBody')}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2.5">
              <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <p className="text-[0.83rem] text-[var(--danger)]">{error}</p>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--ok)_45%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3 py-2.5">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ok)]" />
              <p className="text-[0.83rem] text-[var(--ok)]">{notice}</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === 'signup' && (
              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] font-semibold text-[var(--text-2)]">{t('auth.name')}</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[0.8rem] font-semibold text-[var(--text-2)]">{t('auth.email')}</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                dir="ltr"
              />
            </label>

            {mode !== 'reset' && (
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[0.8rem] font-semibold text-[var(--text-2)]">
                  {t('auth.password')}
                  {mode === 'signin' && (
                    <Link to="/auth/reset" className="font-medium text-[var(--accent-text)] hover:underline">
                      {t('auth.forgot')}
                    </Link>
                  )}
                </span>
                <span className="relative block">
                  <Input
                    type={reveal ? 'text' : 'password'}
                    required
                    minLength={mode === 'signup' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    dir="ltr"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? 'hide' : 'show'}
                    className="focusable absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-3)] hover:text-[var(--text)]"
                  >
                    <Icon name={reveal ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </span>
              </label>
            )}

            {mode === 'signup' && (
              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] font-semibold text-[var(--text-2)]">
                  {t('auth.confirmPassword')}
                </span>
                <Input
                  type={reveal ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                />
              </label>
            )}

            {mode === 'signin' && (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-[0.82rem] text-[var(--text-2)]">{t('auth.remember')}</span>
              </label>
            )}

            {mode === 'signup' && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-[0.8rem] leading-relaxed text-[var(--text-2)]">
                  {t('auth.terms')}{' '}
                  <Link to="/terms" className="text-[var(--accent-text)] hover:underline">
                    {t('legal.terms')}
                  </Link>{' '}
                  ·{' '}
                  <Link to="/privacy" className="text-[var(--accent-text)] hover:underline">
                    {t('legal.privacy')}
                  </Link>
                </span>
              </label>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={busy || loading}
            >
              {mode === 'signup' ? t('auth.signUp') : mode === 'reset' ? t('auth.reset') : t('auth.signIn')}
            </Button>
          </form>

          {mode !== 'reset' && (
            <>
              <div className="my-4 flex items-center gap-3 text-[0.72rem] text-[var(--text-3)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                {t('common.or')}
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await signInWithGoogle();
                    navigate('/');
                  })
                }
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ea4335] text-[0.7rem] font-bold text-white">
                  G
                </span>
                {t('auth.google')}
              </Button>
            </>
          )}

          <p className="mt-5 text-center text-[0.82rem] text-[var(--text-2)]">
            {mode === 'signup' ? (
              <>
                {t('auth.haveAccount')}{' '}
                <Link to="/auth" className="font-bold text-[var(--accent-text)] hover:underline">
                  {t('auth.signIn')}
                </Link>
              </>
            ) : mode === 'reset' ? (
              <Link to="/auth" className="font-bold text-[var(--accent-text)] hover:underline">
                {t('auth.signIn')}
              </Link>
            ) : (
              <>
                {t('auth.noAccount')}{' '}
                <Link to="/auth/signup" className="font-bold text-[var(--accent-text)] hover:underline">
                  {t('auth.signUp')}
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-[0.74rem] text-[var(--text-3)]">
          <Link to="/" className="hover:text-[var(--text-2)] hover:underline">
            {t('common.goHome')}
          </Link>
          <button
            onClick={() => useSettings.getState().set('theme', settings.theme === 'dark' ? 'light' : 'dark')}
            className="focusable flex items-center gap-1 hover:text-[var(--text-2)]"
          >
            <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} className="h-3.5 w-3.5" />
            {t('settings.theme')}
          </button>
          <span className={cn('font-bold')}>{lang === 'ar' ? 'ع' : 'EN'}</span>
        </div>
      </div>
    </div>
  );
}
