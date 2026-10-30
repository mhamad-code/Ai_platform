import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Icon } from '../components/ui';
import { BrandMark } from '../components/Logo';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 opacity-70">
        <BrandMark size={56} />
      </div>
      <p className="font-mono text-[3rem] font-extrabold leading-none text-[var(--accent-text)]">404</p>
      <h1 className="mt-2 text-[1.2rem] font-bold text-[var(--text)]">{t('error.notFound')}</h1>
      <p className="mt-1 max-w-sm text-[0.88rem] text-[var(--text-3)]">{t('error.notFoundSub')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          className="focusable inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[0.88rem] font-bold text-white hover:brightness-110"
        >
          <Icon name="sparkles" className="h-4 w-4" />
          {t('common.goHome')}
        </Link>
        <Link
          to="/chat"
          className="focusable inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-[0.88rem] font-semibold text-[var(--text)] hover:bg-[var(--border)]"
        >
          <Icon name="layers" className="h-4 w-4" />
          {t('nav.chat')}
        </Link>
      </div>
    </div>
  );
}
