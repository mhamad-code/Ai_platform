import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { cn, copyText, formatBytes, price } from '../lib/utils';
import { Badge, Button, Icon, Spinner } from './ui';
import { useI18n } from '../i18n';

/**
 * Renders the `ui.*` blocks the model emits (see src/ai/prompt.ts).
 * Every block is a real component: forms submit back into the conversation,
 * tables sort, tasks toggle, tabs switch — no decorative markup.
 */

export interface ChatActions {
  /** Sends text back to the assistant as a follow-up turn. */
  submit: (text: string) => void;
  busy?: boolean;
}

export const ChatActionsContext = createContext<ChatActions>({
  submit: () => undefined,
  busy: false,
});

export function useChatActions() {
  return useContext(ChatActionsContext);
}

export function parseUIBlock(code: string): { type: string; data: Record<string, unknown> } | null {
  const idx = code.indexOf(' ');
  if (idx < 0) return null;
  const type = code.slice(0, idx).trim();
  const body = code.slice(idx + 1).trim();
  if (!type.startsWith('ui.')) return null;
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    return { type, data };
  } catch {
    return null;
  }
}

function asArr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? fallback : String(v);
}

export function InteractiveBlock({ code }: { code: string }) {
  const parsed = useMemo(() => parseUIBlock(code), [code]);
  if (!parsed) return null;
  const { type, data } = parsed;
  switch (type) {
    case 'ui.form':
      return <FormBlock data={data} />;
    case 'ui.choices':
      return <ChoicesBlock data={data} />;
    case 'ui.cards':
      return <CardGrid data={data} />;
    case 'ui.table':
      return <TableBlock data={data} />;
    case 'ui.chart':
      return <ChartBlock data={data} />;
    case 'ui.steps':
      return <StepsBlock data={data} />;
    case 'ui.tasks':
      return <TasksBlock data={data} />;
    case 'ui.tabs':
      return <TabsBlock data={data} />;
    case 'ui.stats':
      return <StatsBlock data={data} />;
    case 'ui.compare':
      return <CompareBlock data={data} />;
    case 'ui.links':
      return <LinksBlock data={data} />;
    case 'ui.image':
      return <ImageBlock data={data} />;
    case 'ui.products':
    case 'ui.services':
      return <ProductBlock data={data} kind={type === 'ui.products' ? 'product' : 'service'} />;
    default:
      return null;
  }
}

const Shell = ({ title, children, icon }: { title?: string; children: ReactNode; icon?: string }) => (
  <section className="card my-4 overflow-hidden p-0">
    {title && (
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        {icon && <Icon name={icon} className="h-4 w-4 text-[var(--accent-text)]" />}
        <h4 className="text-[0.94rem] font-bold text-[var(--text)]">{title}</h4>
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

/* --------------------------------- form ---------------------------------- */

interface Field {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'radio' | 'checkbox';
  options?: string[];
  value?: string;
  required?: boolean;
}

function FormBlock({ data }: { data: Record<string, unknown> }) {
  const { t } = useI18n();
  const { submit, busy } = useChatActions();
  const fields = asArr(data.fields) as unknown as Field[];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, f.value ?? (f.type === 'checkbox' ? '' : '')])),
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && !String(values[f.id] ?? '').trim());
    if (missing.length) {
      setError(missing[0].label);
      return;
    }
    const lines = fields
      .map((f) => `${f.label}: ${String(values[f.id] ?? '').trim() || '—'}`)
      .filter((l) => !l.endsWith(': —'));
    if (!lines.length) return;
    setDone(true);
    submit(lines.join('\n'));
  };

  if (done)
    return (
      <Shell title={str(data.title)} icon="check">
        <ul className="grid gap-1.5 text-[0.88rem] text-[var(--text-2)]">
          {fields
            .filter((f) => String(values[f.id] ?? '').trim())
            .map((f) => (
              <li key={f.id} className="flex gap-2">
                <Icon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
                <span>
                  <b className="text-[var(--text)]">{f.label}</b> — {values[f.id]}
                </span>
              </li>
            ))}
        </ul>
      </Shell>
    );

  return (
    <Shell title={str(data.title, t('chat.emptyTitle'))} icon="edit">
      <form onSubmit={onSubmit} className="grid gap-3.5">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="mb-1.5 flex items-center gap-1 text-[0.82rem] font-semibold text-[var(--text-2)]">
              {f.label}
              {f.required && <span className="text-[var(--danger)]">*</span>}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                value={values[f.id] ?? ''}
                onChange={(e) => set(f.id, e.target.value)}
                rows={3}
                className="focusable w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[0.9rem] text-[var(--text)] focus:border-[var(--accent)]"
              />
            ) : f.type === 'select' || f.type === 'radio' ? (
              <div className="flex flex-wrap gap-2">
                {(f.options ?? []).map((o) => {
                  const active = values[f.id] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => set(f.id, o)}
                      className={cn(
                        'focusable rounded-lg border px-3 py-1.5 text-[0.84rem] font-medium transition-all',
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : f.type === 'checkbox' ? (
              <div className="flex flex-wrap gap-2">
                {(f.options ?? []).map((o) => {
                  const list = String(values[f.id] ?? '')
                    .split('|')
                    .filter(Boolean);
                  const active = list.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() =>
                        set(f.id, active ? list.filter((x) => x !== o).join('|') : [...list, o].join('|'))
                      }
                      className={cn(
                        'focusable flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.84rem] transition-all',
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)]',
                      )}
                    >
                      <Icon name={active ? 'check' : 'plus'} className="h-3.5 w-3.5" />
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                value={values[f.id] ?? ''}
                onChange={(e) => set(f.id, e.target.value)}
                className="focusable w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[0.9rem] text-[var(--text)] focus:border-[var(--accent)]"
              />
            )}
          </label>
        ))}

        {error && <p className="text-[0.78rem] text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy} icon="send">
            {str(data.submitLabel, t('common.apply'))}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

/* -------------------------------- choices -------------------------------- */

function ChoicesBlock({ data }: { data: Record<string, unknown> }) {
  const { submit, busy } = useChatActions();
  const options = asArr(data.options);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Shell title={str(data.question)} icon="sparkles">
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const label = str(o.label, `Option ${i + 1}`);
          const active = picked === label;
          return (
            <button
              key={i}
              type="button"
              disabled={busy || (picked !== null && !active)}
              onClick={() => {
                setPicked(label);
                submit(label);
              }}
              title={str(o.description)}
              className={cn(
                'focusable rounded-xl border px-3.5 py-2.5 text-start text-[0.88rem] font-semibold transition-all disabled:opacity-50',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border)] bg-[var(--panel-2)] text-[var(--text)] hover:-translate-y-0.5 hover:border-[var(--accent)]',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    active ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
                  )}
                />
                {label}
              </span>
              {str(o.description) && (
                <span className="mt-0.5 block max-w-xs text-[0.76rem] font-normal text-[var(--text-3)]">
                  {str(o.description)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* --------------------------------- cards --------------------------------- */

function CardGrid({ data }: { data: Record<string, unknown> }) {
  const items = asArr(data.items);
  return (
    <Shell title={str(data.title) || undefined} icon="grid">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it, i) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-[0.9rem] font-bold text-[var(--text)]">{str(it.title)}</h5>
                {str(it.badge) && <Badge tone="accent">{str(it.badge)}</Badge>}
              </div>
              <p className="mt-1.5 text-[0.83rem] leading-relaxed text-[var(--text-2)]">{str(it.body)}</p>
            </>
          );
          return str(it.href) ? (
            <a
              key={i}
              href={str(it.href)}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
            >
              {inner}
            </a>
          ) : (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* --------------------------------- table --------------------------------- */

function TableBlock({ data }: { data: Record<string, unknown> }) {
  const columns = asArr(data.columns);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    const base = asArr(data.rows);
    if (!sort) return base;
    return [...base].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * sort.dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * sort.dir;
    });
  }, [data.rows, sort]);

  return (
    <Shell title={str(data.title) || undefined} icon="grid">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => {
                const key = str(c.key);
                const active = sort?.key === key;
                return (
                  <th key={key}>
                    {data.sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) =>
                            s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 },
                          )
                        }
                        className={cn('flex items-center gap-1 font-bold', active && 'text-[var(--accent-text)]')}
                      >
                        {str(c.label, key)}
                        <Icon name="sort" className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
                      </button>
                    ) : (
                      str(c.label, key)
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => {
                  const key = str(c.key);
                  const v = r[key];
                  return (
                    <td key={key}>
                      {c.type === 'url' && typeof v === 'string' ? (
                        <a href={v} target="_blank" rel="noreferrer noopener" className="text-[var(--accent-text)] hover:underline">
                          {v.replace(/^https?:\/\//, '').slice(0, 48)}
                        </a>
                      ) : typeof v === 'number' ? (
                        <span className="font-mono">{v}</span>
                      ) : (
                        String(v ?? '—')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

/* --------------------------------- chart --------------------------------- */

const ChartImpl = lazy(() => import('./ChartBlock'));

function ChartBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <Shell title={str(data.title)} icon="chart">
      <Suspense
        fallback={
          <div className="flex h-56 items-center justify-center text-[var(--text-3)]">
            <Spinner className="h-5 w-5" />
          </div>
        }
      >
        <ChartImpl
          kind={str(data.kind, 'bar') as 'bar' | 'line' | 'pie'}
          data={asArr(data.items ?? data.data).map((d) => ({
            label: str(d.label),
            value: Number(d.value) || 0,
          }))}
          unit={str(data.unit)}
        />
      </Suspense>
    </Shell>
  );
}

/* --------------------------------- steps --------------------------------- */

function StepsBlock({ data }: { data: Record<string, unknown> }) {
  const steps = asArr(data.steps);
  return (
    <Shell title={str(data.title)} icon="layers">
      <ol className="relative ms-3 space-y-4 border-s border-[var(--border)] ps-5">
        {steps.map((s, i) => (
          <li key={i} className="relative">
            <span
              className={cn(
                'absolute -start-[1.9rem] flex h-7 w-7 items-center justify-center rounded-full border text-[0.75rem] font-bold',
                s.done
                  ? 'border-[var(--ok)] bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-[var(--ok)]'
                  : 'border-[var(--border-strong)] bg-[var(--panel-solid)] text-[var(--text-2)]',
              )}
            >
              {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="text-[0.9rem] font-bold text-[var(--text)]">{str(s.title)}</div>
            {str(s.body) && <p className="mt-0.5 text-[0.84rem] leading-relaxed text-[var(--text-2)]">{str(s.body)}</p>}
          </li>
        ))}
      </ol>
    </Shell>
  );
}

/* --------------------------------- tasks --------------------------------- */

function TasksBlock({ data }: { data: Record<string, unknown> }) {
  const items = asArr(data.tasks);
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(items.map((t, i) => (t.done ? i : -1)).filter((i) => i >= 0)),
  );
  const toggle = (i: number) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <Shell title={str(data.title)} icon="check">
      <ul className="space-y-1">
        {items.map((it, i) => {
          const done = checked.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="focusable flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-[var(--border)]"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                    done ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]',
                  )}
                >
                  {done && <Icon name="check" className="h-3 w-3 text-white" />}
                </span>
                <span
                  className={cn(
                    'text-[0.88rem] leading-relaxed',
                    done ? 'text-[var(--text-3)] line-through' : 'text-[var(--text)]',
                  )}
                >
                  {str(it.text)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

/* ---------------------------------- tabs --------------------------------- */

function TabsBlock({ data }: { data: Record<string, unknown> }) {
  const tabs = asArr(data.tabs);
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <section className="card my-4 overflow-hidden">
      <div className="flex overflow-x-auto border-b border-[var(--border)] p-1.5">
        {tabs.map((tb, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'focusable whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.84rem] font-semibold transition-all',
              i === active
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
            )}
          >
            {str(tb.label, `Tab ${i + 1}`)}
          </button>
        ))}
      </div>
      <div className="p-4">
        <TabBody text={str(current.body)} />
      </div>
    </section>
  );
}

/** Markdown bodies inside tabs would import Markdown circularly — keep it lazy-free & simple. */
function TabBody({ text }: { text: string }) {
  return <SimpleMarkdown text={text} />;
}

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="md space-y-2 text-[0.88rem] leading-relaxed text-[var(--text-2)]">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc ps-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-*]\s+/, '')}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={i} className="list-decimal ps-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*\d+[.)]\s+/, '')}</li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="whitespace-pre-wrap">
            {b}
          </p>
        );
      })}
    </div>
  );
}

/* --------------------------------- stats --------------------------------- */

function StatsBlock({ data }: { data: Record<string, unknown> }) {
  const items = asArr(data.items);
  return (
    <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((s, i) => (
        <div key={i} className="card p-3.5">
          <div className="text-[0.74rem] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {str(s.label)}
          </div>
          <div className="mt-1 font-mono text-[1.4rem] font-extrabold text-[var(--text)]">{str(s.value)}</div>
          {str(s.delta) && (
            <div className="mt-0.5 text-[0.75rem] font-semibold text-[var(--ok)]">{str(s.delta)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- compare -------------------------------- */

function CompareBlock({ data }: { data: Record<string, unknown> }) {
  const left = (data.left ?? {}) as Record<string, unknown>;
  const right = (data.right ?? {}) as Record<string, unknown>;
  const rows = asArr(data.rows);

  return (
    <Shell title={str(data.title) || `${str(left.title)} ⇄ ${str(right.title)}`} icon="layers">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 text-[0.85rem]">
        <div className="pb-2 text-center font-bold text-[var(--text)]">{str(left.title, 'A')}</div>
        <div className="w-8" />
        <div className="pb-2 text-center font-bold text-[var(--text)]">{str(right.title, 'B')}</div>

        {rows.map((r, i) => (
          <RowCells key={i} label={str(r.label)} a={str(r.left)} b={str(r.right)} />
        ))}
      </div>
    </Shell>
  );
}

function RowCells({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <>
      <div className="rounded-lg bg-[var(--panel-2)] px-3 py-2 text-center text-[var(--text-2)]">{a || '—'}</div>
      <div className="flex w-8 items-center justify-center px-1 text-center text-[0.7rem] font-bold uppercase text-[var(--text-3)]">
        {label}
      </div>
      <div className="rounded-lg bg-[var(--panel-2)] px-3 py-2 text-center text-[var(--text-2)]">{b || '—'}</div>
    </>
  );
}

/* --------------------------------- links --------------------------------- */

function LinksBlock({ data }: { data: Record<string, unknown> }) {
  const links = asArr(data.links);
  return (
    <Shell title={str(data.title) || undefined} icon="link">
      <ul className="space-y-2">
        {links.map((l, i) => {
          const url = str(l.url);
          let host = '';
          try {
            host = new URL(url).hostname.replace(/^www\./, '');
          } catch {
            host = '';
          }
          return (
            <li key={i}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <Icon name="globe" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[0.88rem] font-bold text-[var(--text)] group-hover:underline">
                      {str(l.title, url)}
                    </span>
                    <Icon name="external" className="h-3 w-3 shrink-0 text-[var(--text-3)]" />
                  </span>
                  <span className="block truncate font-mono text-[0.72rem] text-[var(--accent-text)]">{host}</span>
                  {str(l.snippet) && (
                    <span className="mt-1 block text-[0.8rem] leading-relaxed text-[var(--text-2)]">
                      {str(l.snippet)}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

/* --------------------------------- image --------------------------------- */

function ImageBlock({ data }: { data: Record<string, unknown> }) {
  const [failed, setFailed] = useState(false);
  const src = str(data.src);
  if (!src || failed)
    return (
      <div className="card my-4 flex h-40 items-center justify-center text-[0.82rem] text-[var(--text-3)]">
        Image unavailable
      </div>
    );
  return (
    <figure className="card my-4 overflow-hidden p-0">
      <img
        src={src}
        alt={str(data.alt, '')}
        onError={() => setFailed(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="max-h-[26rem] w-full object-cover"
      />
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-[0.78rem] text-[var(--text-3)]">
        {str(data.caption) && <span className="font-medium text-[var(--text-2)]">{str(data.caption)}</span>}
        {str(data.source) && (
          <a href={str(data.source)} target="_blank" rel="noreferrer noopener" className="text-[var(--accent-text)] hover:underline">
            {str(data.source).replace(/^https?:\/\//, '').slice(0, 60)}
          </a>
        )}
        {str(data.license) && <span className="rounded bg-[var(--border)] px-1.5 py-0.5">{str(data.license)}</span>}
      </figcaption>
    </figure>
  );
}

/* ------------------------------ products/services ------------------------ */

function ProductBlock({ data, kind }: { data: Record<string, unknown>; kind: 'product' | 'service' }) {
  const items = asArr(data.items);
  return (
    <Shell title={str(data.title)} icon={kind === 'product' ? 'grid' : 'puzzle'}>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((p, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5"
          >
            <div className="min-w-0">
              <div className="text-[0.9rem] font-bold text-[var(--text)]">{str(p.title)}</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-[var(--text-2)]">{str(p.body)}</p>
              {str(p.href) && (
                <a
                  href={str(p.href)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-[var(--accent-text)] hover:underline"
                >
                  <Icon name="external" className="h-3 w-3" /> Details
                </a>
              )}
            </div>
            {str(p.price) && <Badge tone="ok">{str(p.price)}</Badge>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* --------------------------- misc small helpers -------------------------- */

export function FileChip({ name, size, kind }: { name: string; size: number; kind?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[0.78rem] text-[var(--text-2)]">
      <Icon name={kind === 'image' ? 'image' : 'file'} className="h-3.5 w-3.5" />
      <span className="max-w-[10rem] truncate">{name}</span>
      <span className="text-[var(--text-3)]">{size ? formatBytes(size) : ''}</span>
    </span>
  );
}

export function PriceText({ input, output, free }: { input?: number | null; output?: number | null; free?: boolean }) {
  const { t } = useI18n();
  if (free) return <span className="font-bold text-[var(--ok)]">{t('common.free')}</span>;
  return (
    <span className="font-mono text-[0.75rem] text-[var(--text-2)]">
      {price(input)} {t('models.priceIn')} · {price(output)} {t('models.priceOut')}{' '}
      <span className="text-[var(--text-3)]">{t('models.perMTok')}</span>
    </span>
  );
}

export async function copyToClipboard(text: string) {
  return copyText(text);
}
