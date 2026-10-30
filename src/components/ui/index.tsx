import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils';

/* ------------------------------- Button ---------------------------------- */

type Variant = 'primary' | 'ghost' | 'outline' | 'soft' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-white hover:brightness-110 active:brightness-95 shadow-[0_6px_18px_-8px_var(--accent)]',
  soft: 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:brightness-110',
  ghost: 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
  outline: 'border border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--border)]',
  subtle: 'bg-[var(--panel-2)] text-[var(--text)] border border-[var(--border)] hover:brightness-110',
  danger: 'bg-[var(--danger)] text-white hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.82rem] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-[0.9rem] rounded-xl gap-2',
  lg: 'h-12 px-6 text-[0.98rem] rounded-xl gap-2',
  icon: 'h-9 w-9 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focusable inline-flex items-center justify-center font-semibold transition-all duration-150 select-none',
        'disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

/* ------------------------------- Spinner --------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------- Badge ---------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'brand';
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: 'bg-[var(--border)] text-[var(--text-2)] border-transparent',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-transparent',
    ok: 'bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-[var(--ok)] border-transparent',
    warn: 'bg-[color-mix(in_srgb,#f5a524_18%,transparent)] text-[#f5a524] border-transparent',
    danger: 'bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)] border-transparent',
    brand: 'bg-white/10 text-white border-white/20',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.72rem] font-semibold leading-5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className,
  onClick,
  hover = true,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  as?: 'div' | 'article' | 'button';
}) {
  return (
    <As
      onClick={onClick}
      className={cn(
        'card p-4',
        hover && 'hover:-translate-y-0.5 hover:shadow-[var(--shadow)] cursor-pointer',
        onClick && 'text-start',
        className,
      )}
    >
      {children}
    </As>
  );
}

/* ---------------------------- Form controls ------------------------------ */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { wrapClassName?: string }>(
  function Input({ className, wrapClassName, ...rest }, ref) {
    if (rest.type === 'hidden') return <input ref={ref} {...rest} />;
    return (
      <div className={cn('relative', wrapClassName)}>
        <input
          ref={ref}
          className={cn(
            'focusable w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-[0.92rem]',
            'text-[var(--text)] placeholder:text-[var(--text-3)] transition-colors focus:border-[var(--accent)]',
            rest.disabled && 'opacity-60',
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'focusable w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-[0.92rem]',
        'text-[var(--text)] placeholder:text-[var(--text-3)] transition-colors focus:border-[var(--accent)]',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'focusable w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-[0.92rem]',
        'text-[var(--text)] transition-colors focus:border-[var(--accent)]',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[0.75rem] text-[var(--text-3)]">{hint}</span>}
      {error && <span className="mt-1 block text-[0.75rem] text-[var(--danger)]">{error}</span>}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && <div className="text-[0.9rem] font-semibold text-[var(--text)]">{label}</div>}
          {description && <div className="text-[0.78rem] text-[var(--text-3)]">{description}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'focusable relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ insetInlineStart: checked ? '1.375rem' : '0.125rem' }}
        />
      </button>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="focusable h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)] disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, var(--accent) ${((value - min) / (max - min)) * 100}%, var(--border-strong) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
      <span className="min-w-[3.2rem] text-end font-mono text-[0.78rem] text-[var(--text-2)]">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-1',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'focusable rounded-lg font-semibold transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-[0.76rem]' : 'px-3 py-1.5 text-[0.85rem]',
            value === o.value
              ? 'bg-[var(--accent)] text-white shadow'
              : 'text-[var(--text-2)] hover:text-[var(--text)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Feedback -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          {icon}
        </div>
      )}
      <h3 className="text-[1rem] font-bold text-[var(--text)]">{title}</h3>
      {body && <p className="mt-1 max-w-md text-[0.86rem] leading-relaxed text-[var(--text-3)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--text-3)]">
      {children}
    </kbd>
  );
}

/* -------------------------------- Tooltip -------------------------------- */

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--panel-solid)] px-2.5 py-1.5 text-[0.75rem] font-semibold text-[var(--text)] shadow-[var(--shadow)] animate-slideIn"
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* ------------------------------ Progress --------------------------------- */

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------ Inline icon ------------------------------ */

export function Icon({ name, className }: { name: string; className?: string }) {
  const d = PATHS[name] ?? PATHS.dot;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-[1.125rem] w-[1.125rem]', className)}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  stop: 'M7 7h10v10H7z',
  copy: 'M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z',
  archive: 'M3 8h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8zM3 4h18v4H3zM10 12h4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  mic: 'M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4',
  bookmark: 'M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z',
  check: 'M4 12.5 9 17.5 20 6.5',
  x: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sparkles: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  layers: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  puzzle: 'M10 3h4v2.5a1.5 1.5 0 1 0 3 0V3h4v4h-2.5a1.5 1.5 0 1 0 0 3H21v4h-2.5a1.5 1.5 0 1 0 0 3H21v4h-4v-2.5a1.5 1.5 0 1 0-3 0V21h-4v-4H7.5a1.5 1.5 0 1 1 0-3H10V3z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8.4-8 9.7C7.2 20.4 4 16.5 4 12V6l8-3z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  play: 'M6 4l14 8-14 8V4z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14',
  terminal: 'M5 7l5 5-5 5M12 17h7',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.1M6.2 6.2C3.6 7.9 2 12 2 12s3.6 7 10 7c1.3 0 2.4-.2 3.5-.6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
  dot: 'M12 12h.01',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
  key: 'M15 7a4 4 0 1 1-3.9 5H9v2H7v2H4v-3l6.1-6.1A4 4 0 0 1 15 7z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  sort: 'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3',
  volume: 'M11 5 6 9H3v6h3l5 4V5zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  square: 'M5 5h14v14H5z',
};

export { useId, useRef, useEffect, useState };
