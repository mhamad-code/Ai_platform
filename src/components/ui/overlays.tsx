import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { Button, Icon, Spinner } from './index';
import { useUI } from '../../store/ui';
import { useI18n } from '../../i18n';

/* -------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
}) {
  const { dir } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full animate-slideIn rounded-t-2xl border border-[var(--border)] bg-[var(--panel-solid)] shadow-[var(--shadow)] sm:rounded-2xl',
          width,
        )}
        style={{ maxHeight: '88vh' }}
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          {icon && <span className="text-[var(--accent-text)]">{icon}</span>}
          <h2 className="flex-1 text-[1.02rem] font-bold text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="focusable rounded-lg p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <Icon name="x" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(88vh - 8rem)' }}>
          {children}
        </div>
        {footer && (
          <footer
            className={cn(
              'flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5',
              dir === 'rtl' && 'justify-start',
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------- Confirmation dialog ------------------------- */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {body && <p className="text-[0.9rem] leading-relaxed text-[var(--text-2)]">{body}</p>}
    </Modal>
  );
}

/* -------------------------------- Dropdown ------------------------------- */

export function Dropdown({
  trigger,
  children,
  align = 'start',
  width = 'w-56',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] animate-slideIn overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-solid)] p-1 shadow-[var(--shadow)]',
            align === 'start' ? 'start-0' : 'end-0',
            width,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'focusable flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[0.86rem] font-medium transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        danger
          ? 'text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]'
          : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
      )}
    >
      {icon && <Icon name={icon} className="h-4 w-4 opacity-80" />}
      <span className="flex-1">{children}</span>
    </button>
  );
}

/* --------------------------------- Toasts -------------------------------- */

export function ToastHost() {
  const { toasts, dismiss } = useUI();
  const { t } = useI18n();
  if (!toasts.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 start-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--panel-solid)] px-4 py-3 shadow-[var(--shadow)] animate-slideIn',
            toast.kind === 'error'
              ? 'border-[var(--danger)]'
              : toast.kind === 'success'
                ? 'border-[var(--ok)]'
                : 'border-[var(--border)]',
          )}
        >
          <span
            className={cn(
              'mt-0.5',
              toast.kind === 'error'
                ? 'text-[var(--danger)]'
                : toast.kind === 'success'
                  ? 'text-[var(--ok)]'
                  : 'text-[var(--accent-text)]',
            )}
          >
            <Icon name={toast.kind === 'error' ? 'warn' : toast.kind === 'success' ? 'check' : 'info'} />
          </span>
          <div className="flex-1 text-[0.86rem] font-medium text-[var(--text)]">{toast.text}</div>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
              className="text-[0.8rem] font-bold text-[var(--accent-text)] hover:underline"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => dismiss(toast.id)}
            aria-label={t('common.close')}
            className="text-[var(--text-3)] hover:text-[var(--text)]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ------------------------------ Async action ----------------------------- */

export function useAsync<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const run = async (...args: T) => {
    setLoading(true);
    try {
      await fn(...args);
    } finally {
      setLoading(false);
    }
  };
  return [run, loading] as const;
}

export { Spinner };
