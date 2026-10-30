import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CodeBlock, DiagramBlock } from './CodeBlock';
import { InteractiveBlock } from './Interactive';
import { Icon } from './ui';

/**
 * Message renderer: Markdown + GFM + maths + code highlighting + the
 * interactive `ui.*` protocol. Raw HTML in model output is deliberately NOT
 * executed (no rehype-raw), so a prompt cannot inject markup into the app.
 */
export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          pre: ({ children: raw }) => {
            const block = Array.isArray(raw) ? raw[0] : raw;
            const props = (block as { props?: { className?: string; children?: ReactNode } })?.props;
            const className = props?.className ?? '';
            const inner = props?.children;
            const code = Array.isArray(inner) ? inner.join('') : String(inner ?? '');
            const match = /language-(.+)/.exec(className);
            const lang = (match?.[1] ?? '').trim();

            if (lang.startsWith('ui.')) return <InteractiveBlock code={`${lang} ${code}`} />;
            if (lang === 'mermaid') return <DiagramBlock code={code} />;
            return <CodeBlock code={code} lang={lang} />;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" title={href}>
              {children}
              <Icon name="external" className="ms-1 inline h-3 w-3 align-baseline opacity-60" />
            </a>
          ),
          table: ({ children }) => (
            <div className="table-wrap my-4">
              <table>{children}</table>
            </div>
          ),
          img: (props) => <MarkdownImage {...props} />,
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const url = String(src ?? '');
  if (!/^https?:\/\//i.test(url)) return null;
  if (failed)
    return (
      <span className="my-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[0.78rem] text-[var(--text-3)]">
        <Icon name="image" className="h-3.5 w-3.5" /> {alt || 'image'} — unavailable
      </span>
    );
  return (
    <span className="my-2 block">
      <img
        src={url}
        alt={alt ?? ''}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="max-h-[28rem] w-full rounded-xl border border-[var(--border)] object-cover"
      />
      {alt && <span className="mt-1 block text-[0.75rem] text-[var(--text-3)]">{alt}</span>}
    </span>
  );
}
