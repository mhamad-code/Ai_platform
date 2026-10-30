import { useState } from 'react';
import { cn } from '../lib/utils';

/** Platform mark: a stone silhouette with a spark — echoes the reference art. */
export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="AI Platform"
    >
      <defs>
        <linearGradient id="bm-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B7CD6" />
          <stop offset="55%" stopColor="#3563E6" />
          <stop offset="100%" stopColor="#1E242D" />
        </linearGradient>
        <linearGradient id="bm-rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8ECF2" />
          <stop offset="100%" stopColor="#8A97AB" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#bm-sky)" />
      <path
        d="M6 40c4-9 9-14 15-17 4-2 7-5 9-8 3 4 7 9 10 15 2 4 3 7 4 10H6z"
        fill="url(#bm-rock)"
        opacity="0.92"
      />
      <path d="M24 10l1.9 4.4L30 16.5l-4.1 2.1L24 23l-1.9-4.4L18 16.5l4.1-2.1L24 10z" fill="#fff" />
      <path d="M4 41h40" stroke="#0B0E13" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-[0.98rem] font-extrabold tracking-tight text-[var(--text)]">
            AI Platform
          </span>
          <span className="text-[0.63rem] font-medium text-[var(--text-3)]">
            Your AI. Your Tools. One Platform.
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Vendor logo. Uses official brand marks from the Simple Icons CDN and falls
 * back to a monogram tile with the vendor's brand colour when the mark cannot
 * be loaded (offline, blocked, unknown slug) — never a random image.
 */
export function VendorLogo({
  name,
  slug,
  color,
  size = 40,
  rounded = 'rounded-xl',
  className,
}: {
  name: string;
  slug: string;
  color: string;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 shadow-sm',
        rounded,
        className,
      )}
      style={{ width: size, height: size, background: color }}
      title={name}
    >
      {!failed ? (
        <img
          src={`https://cdn.simpleicons.org/${slug}/FFFFFF`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: size * 0.56, height: size * 0.56 }}
          className="object-contain"
        />
      ) : (
        <span
          className="font-extrabold text-white"
          style={{ fontSize: size * 0.44, lineHeight: 1 }}
          aria-hidden
        >
          {letter}
        </span>
      )}
    </span>
  );
}
