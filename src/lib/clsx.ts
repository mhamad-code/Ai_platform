/** Tiny dependency-free class-name joiner. */
export function clsxSafe(parts: unknown[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === 'string') out.push(p);
    else if (typeof p === 'number') out.push(String(p));
    else if (Array.isArray(p)) {
      const nested = clsxSafe(p);
      if (nested) out.push(nested);
    } else if (typeof p === 'object') {
      for (const [k, v] of Object.entries(p as Record<string, unknown>)) if (v) out.push(k);
    }
  }
  return out.join(' ');
}
