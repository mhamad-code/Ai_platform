import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn, copyText, downloadText } from '../lib/utils';
import { Icon, Spinner } from './ui';
import { useI18n } from '../i18n';

/* ------------------------------------------------------------------ *
 * Syntax highlighting is loaded lazily so the initial bundle stays
 * small; highlight.js ships definitions for 190+ languages.
 * ------------------------------------------------------------------ */

type Hljs = typeof import('highlight.js').default;
let hljsPromise: Promise<Hljs> | null = null;
function loadHljs(): Promise<Hljs> {
  if (!hljsPromise) hljsPromise = import('highlight.js').then((m) => m.default);
  return hljsPromise;
}

const EXT: Record<string, string> = {
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  js: 'js',
  javascript: 'js',
  jsx: 'jsx',
  json: 'json',
  html: 'html',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  python: 'py',
  py: 'py',
  bash: 'sh',
  shell: 'sh',
  sh: 'sh',
  sql: 'sql',
  md: 'md',
  markdown: 'md',
  yaml: 'yml',
  yml: 'yml',
  go: 'go',
  rust: 'rs',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  php: 'php',
  ruby: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  dart: 'dart',
  dockerfile: 'Dockerfile',
  diff: 'diff',
  ini: 'ini',
  graphql: 'graphql',
  proto: 'proto',
  vue: 'vue',
  svelte: 'svelte',
};

/** Terms we accept as a language tag — everything else is treated as plain text. */
const KNOWN = new Set([
  ...Object.keys(EXT),
  'jsx',
  'powershell',
  'makefile',
  'nginx',
  'apache',
  'ruby',
  'perl',
  'lua',
  'r',
  'matlab',
  'haskell',
  'elixir',
  'clojure',
  'scheme',
  'lisp',
  'fortran',
  'pascal',
  'vbnet',
  'objective-c',
  'wasm',
  'wat',
  'hcl',
  'terraform',
  'csv',
  'text',
  'txt',
  'plaintext',
  'none',
]);

export function normaliseLang(raw?: string): string {
  const l = (raw ?? '').toLowerCase().trim();
  if (!l) return '';
  if (KNOWN.has(l)) return l;
  return '';
}

const PREVIEWABLE = new Set(['html', 'css', 'js', 'javascript', 'xml']);

function previewDoc(lang: string, code: string): string {
  if (lang === 'html' || lang === 'xml') return code;
  if (lang === 'css')
    return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head><body><div class="preview">Preview</div></body></html>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${code.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const { t } = useI18n();
  const language = normaliseLang(lang);
  const [engine, setEngine] = useState<Hljs | null>(null);
  const [html, setHtml] = useState('');
  const [detected, setDetected] = useState('');
  const [copied, setCopied] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const collapsible = lines.length > 28;

  useEffect(() => {
    let alive = true;
    loadHljs()
      .then((h) => alive && setEngine(h))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    try {
      if (language && engine.getLanguage(language)) {
        const res = engine.highlight(code, { language, ignoreIllegals: true });
        setHtml(res.value);
        setDetected(language);
      } else {
        const res = engine.highlightAuto(code);
        setHtml(res.value);
        setDetected(res.language ?? '');
      }
    } catch {
      setHtml(code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string));
      setDetected(language);
    }
  }, [engine, code, language]);

  const label = language || detected || 'text';
  const onCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  const onDownload = () => {
    const ext = EXT[label] ?? 'txt';
    downloadText(`snippet.${ext}`, code, 'text/plain');
  };

  return (
    <figure className="group/code my-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-2)]">
      <figcaption className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5">
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[0.7rem] font-bold text-[var(--accent-text)]">
          <Icon name="code" className="h-3 w-3" />
          {label}
        </span>
        <span className="ms-1 hidden font-mono text-[0.68rem] text-[var(--text-3)] sm:inline">
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>

        <span className="ms-auto flex items-center gap-0.5">
          {PREVIEWABLE.has(language) && (
            <HeadBtn
              active={preview}
              label={preview ? t('common.close') : 'Preview'}
              onClick={() => setPreview((v) => !v)}
              icon="eye"
            />
          )}
          <HeadBtn
            active={showLines}
            label="Lines"
            onClick={() => setShowLines((v) => !v)}
            icon="hash"
          />
          <HeadBtn label={copied ? t('common.copied') : t('common.copy')} onClick={onCopy} icon={copied ? 'check' : 'copy'} />
          <HeadBtn label={t('common.download')} onClick={onDownload} icon="download" />
        </span>
      </figcaption>

      {preview ? (
        <iframe
          title="preview"
          srcDoc={previewDoc(language, code)}
          sandbox="allow-scripts"
          className="h-72 w-full bg-white"
        />
      ) : (
        <div className={cn('relative', expanded ? '' : collapsible && 'max-h-[26rem] overflow-hidden')}>
          <div className="flex overflow-x-auto">
            {showLines && (
              <div
                aria-hidden
                className="sticky start-0 z-10 select-none border-e border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-3 text-end font-mono text-[0.75rem] leading-[1.55] text-[var(--text-3)]"
              >
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}
            <pre className="min-w-0 flex-1 px-3.5 py-3 font-mono text-[0.8rem] leading-[1.55] text-[var(--text)]">
              {engine && html ? (
                <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <code className="hljs">{code}</code>
              )}
            </pre>
          </div>

          {!engine && (
            <span className="absolute bottom-2 end-3 flex items-center gap-1.5 rounded-md bg-[var(--panel-solid)] px-2 py-1 text-[0.7rem] text-[var(--text-3)]">
              <Spinner className="h-3 w-3" /> highlighter
            </span>
          )}

          {collapsible && !expanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg-2)] to-transparent" />
          )}
        </div>
      )}

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="focusable flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] bg-[var(--panel-2)] py-2 text-[0.78rem] font-semibold text-[var(--text-2)] hover:text-[var(--text)]"
        >
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5" />
          {expanded ? t('common.showLess') : t('common.showMore')}
        </button>
      )}
    </figure>
  );
}

function HeadBtn({
  label,
  onClick,
  icon,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'focusable rounded-md p-1.5 transition-colors',
        active ? 'text-[var(--accent-text)]' : 'text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]',
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Diagrams (mermaid) — lazy, never blocks the message render.
 * ------------------------------------------------------------------ */

export function DiagramBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let id = 0;
    import('mermaid')
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
          fontFamily: 'inherit',
        });
        const { svg } = await mermaid.render(`mmd-${++id}`, code);
        if (alive) setSvg(svg);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code]);

  if (failed) return <CodeBlock code={code} lang="text" />;
  if (!svg)
    return (
      <div className="card my-4 flex h-40 items-center justify-center gap-2 text-[var(--text-3)]">
        <Spinner className="h-4 w-4" /> diagram
      </div>
    );

  return (
    <div
      className="card my-4 flex justify-center overflow-x-auto p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-[var(--border)] px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}
