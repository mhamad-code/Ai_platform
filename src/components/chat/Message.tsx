import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, SourceItem } from '../../ai/types';
import { messageText, useChat } from '../../store/chat';
import { useSettings } from '../../store/settings';
import { useI18n } from '../../i18n';
import { useUI } from '../../store/ui';
import { cn, copyText, downloadText, formatDate, uid } from '../../lib/utils';
import { tts, speakable } from '../../lib/tts';
import { selectionPrompt } from '../../ai/prompt';
import { files as filesWs } from '../../lib/workspace';
import Markdown from '../Markdown';
import { Badge, Icon } from '../ui';
import { BrandMark } from '../Logo';

interface Props {
  msg: ChatMessage;
  streaming?: boolean;
  onFollowUp?: (text: string) => void;
}

export default function Message({ msg, streaming, onFollowUp }: Props) {
  const { t, lang } = useI18n();
  const settings = useSettings();
  const toast = useUI((s) => s.toast);
  const rate = useChat((s) => s.rate);
  const retry = useChat((s) => s.retry);
  const webSearch = useChat((s) => s.webSearch);
  const setOption = useChat((s) => s.setOption);
  const streamingNow = useChat((s) => s.streaming);

  const isUser = msg.role === 'user';
  const text = messageText(msg);

  const [speaking, setSpeaking] = useState(false);
  const [showSources, setShowSources] = useState(true);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const un = tts.subscribe(() => setSpeaking(tts.state !== 'idle'));
    return () => {
      un();
    };
  }, []);

  const sources: SourceItem[] = msg.sources ?? [];

  /* ------------------------------ actions ------------------------------- */

  const onSpeak = () => {
    const ok = tts.speak(speakable(text), { lang, voiceURI: settings.voiceURI });
    if (!ok) toast(t('chat.errorGeneric'), 'error');
  };
  const onShare = async () => {
    const payload = { title: 'AI Platform', text: text.slice(0, 3000) };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user cancelled or blocked — fall through to copy */
      }
    }
    if (await copyText(`${payload.title}\n\n${payload.text}`)) toast(t('common.copied'), 'success');
  };
  const onSave = async () => {
    const blobPart = `# ${msg.model ?? 'AI Platform'}\n\n${text}\n\n${
      sources.map((s) => `- [${s.title}](${s.url})`).join('\n') ?? ''
    }\n`;
    const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(blobPart)}`;
    const name = `${(msg.model || 'answer').replace(/[^\w.-]+/g, '-').slice(0, 32)}-${Date.now()}.md`;
    await filesWs.save({
      id: uid(),
      name,
      folderId: null,
      size: blobPart.length,
      mime: 'text/markdown',
      kind: 'text',
      path: `library/${name}`,
      url,
      createdAt: Date.now(),
    });
    toast(t('chat.saved'), 'success');
  };
  const onExport = () =>
    downloadText(
      `answer-${new Date().toISOString().slice(0, 10)}.md`,
      `${text}\n\n${sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}`,
      'text/markdown',
    );

  /* ---------------------------- selection menu --------------------------- */

  const checkSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const value = sel.toString().trim();
    if (value.length < 4 || !bodyRef.current) return;
    if (!bodyRef.current.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ text: value, x: rect.left + rect.width / 2, y: rect.top });
  };

  const actOnSelection = (action: 'explain' | 'translate' | 'summarize') => {
    if (!selection || !onFollowUp) return;
    onFollowUp(selectionPrompt(action, selection.text, lang));
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  /* ------------------------------- rendering ----------------------------- */

  return (
    <article
      className={cn(
        'group/msg relative flex gap-3 px-4 py-5 transition-colors sm:px-6',
        isUser ? 'flex-row-reverse' : '',
      )}
      onMouseUp={isUser ? undefined : checkSelection}
      onTouchEnd={isUser ? undefined : checkSelection}
    >
      {/* avatar */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[0.8rem] font-bold text-[var(--accent-text)]">
            {lang === 'ar' ? 'أ' : 'U'}
          </span>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-solid)]">
            <BrandMark size={20} />
          </span>
        )}
      </div>

      <div className={cn('min-w-0 flex-1', isUser && 'flex flex-col items-end')}>
        {/* meta line */}
        <div className={cn('mb-1.5 flex flex-wrap items-center gap-2', isUser && 'flex-row-reverse')}>
          <span className="text-[0.76rem] font-bold text-[var(--text-2)]">
            {isUser ? (lang === 'ar' ? 'أنت' : 'You') : msg.model || t('brand')}
          </span>
          {!isUser && msg.provider && <Badge tone="accent">{msg.provider}</Badge>}
          <span className="text-[0.68rem] text-[var(--text-3)]">{formatDate(msg.createdAt, lang)}</span>
        </div>

        {/* body */}
        <div
          ref={bodyRef}
          className={cn(
            'min-w-0 max-w-full',
            isUser &&
              'rounded-2xl rounded-ee-md border border-[var(--border)] bg-[var(--bubble-user)] px-4 py-3 text-[var(--text)]',
          )}
        >
          {msg.error ? (
            <div className="rounded-xl border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3">
              <div className="flex items-center gap-2 text-[0.86rem] font-bold text-[var(--danger)]">
                <Icon name="warn" className="h-4 w-4" /> {t(msg.error as never)}
              </div>
              {msg.errorDetail ? (
                <p dir="auto" className="mt-1 break-words text-[0.8rem] text-[var(--text-2)]">
                  {msg.errorDetail}
                </p>
              ) : (
                <p className="mt-1 text-[0.8rem] text-[var(--text-2)]">{t('chat.notConfiguredBody')}</p>
              )}
              <button
                onClick={() => void retry()}
                className="focusable mt-2 rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[0.8rem] font-semibold hover:bg-[var(--border)]"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap text-[0.94rem] leading-relaxed">{text}</div>
          ) : (
            <>
              {streaming && !text && (
                <div className="flex items-center gap-2 text-[0.85rem] text-[var(--text-3)]">
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                  </span>
                  {t('chat.thinking')}
                </div>
              )}
              {text && <Markdown>{text}</Markdown>}
              {streaming && text && <span className="ms-0.5 inline-block h-4 w-2 animate-blink bg-[var(--accent)] align-middle" />}
            </>
          )}
        </div>

        {/* attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={cn('mt-2 flex flex-wrap gap-2', isUser && 'flex-row-reverse')}>
            {msg.attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[0.78rem] text-[var(--text-2)]"
              >
                <Icon name={a.kind === 'image' ? 'image' : 'file'} className="h-3.5 w-3.5" />
                <span className="max-w-[10rem] truncate">{a.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* sources */}
        {!isUser && sources.length > 0 && showSources && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-3)]">
              <Icon name="globe" className="h-3.5 w-3.5" /> {t('chat.sources')}
              <span className="rounded bg-[var(--border)] px-1.5">{sources.length}</span>
            </div>
            <ol className="grid gap-1.5">
              {sources.map((s, i) => (
                <li key={s.url + i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--border)]"
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-end font-mono text-[0.7rem] text-[var(--text-3)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.83rem] font-semibold text-[var(--text)] group-hover:underline">
                        {s.title}
                      </span>
                      <span className="block truncate font-mono text-[0.7rem] text-[var(--accent-text)]">
                        {(() => {
                          try {
                            return new URL(s.url).hostname.replace(/^www\./, '');
                          } catch {
                            return s.url;
                          }
                        })()}
                        {s.publishedAt ? ` · ${s.publishedAt}` : ''}
                      </span>
                      {s.snippet && (
                        <span className="mt-0.5 block text-[0.78rem] leading-snug text-[var(--text-3)]">
                          {s.snippet}
                        </span>
                      )}
                    </span>
                    <Icon name="external" className="mt-1 h-3 w-3 shrink-0 text-[var(--text-3)]" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* action bar */}
        {!isUser && !msg.error && (
          <div className="mt-3 flex flex-wrap items-center gap-0.5">
            <Act
              icon="refresh"
              label={t('chat.retryMsg')}
              onClick={() => void retry()}
              disabled={streamingNow}
            />
            <Act
              icon="copy"
              label={t('chat.copyMsg')}
              onClick={async () => (await copyText(text)) && toast(t('common.copied'), 'success')}
            />
            <Act icon="volume" label={t('chat.speakMsg')} onClick={onSpeak} disabled={speaking} />
            <Act icon="stop" label={t('chat.stopSpeak')} onClick={() => tts.stop()} disabled={!speaking} />
            <Act
              icon="search"
              label={t('chat.webSearch')}
              active={webSearch}
              onClick={() => {
                setOption('webSearch', !webSearch);
                toast(!webSearch ? t('chat.searchToggleOn') : t('chat.searchToggleOff'));
              }}
            />
            {sources.length > 0 && (
              <Act
                icon="link"
                label={t('chat.sources')}
                active={showSources}
                onClick={() => setShowSources((v) => !v)}
              />
            )}
            <Act
              icon="check"
              label={t('chat.rateUp')}
              active={msg.rating === 1}
              onClick={() => rate(msg.id, msg.rating === 1 ? -1 : 1)}
            />
            <Act
              icon="warn"
              label={t('chat.rateDown')}
              active={msg.rating === -1}
              onClick={() => rate(msg.id, msg.rating === -1 ? 1 : -1)}
            />
            <Act icon="share" label={t('chat.shareMsg')} onClick={onShare} />
            <Act icon="bookmark" label={t('chat.saveMsg')} onClick={() => void onSave()} />
            <Act icon="download" label={t('chat.exportMsg')} onClick={onExport} />
          </div>
        )}
      </div>

      {/* selection toolbar */}
      {selection && onFollowUp && (
        <div
          className="fixed z-[80] -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: Math.max(8, selection.y - 8) }}
        >
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-solid)] p-1 shadow-[var(--shadow)] animate-slideIn">
            <SelBtn icon="book" label={t('chat.explain')} onClick={() => actOnSelection('explain')} />
            <SelBtn icon="globe" label={t('chat.translate')} onClick={() => actOnSelection('translate')} />
            <SelBtn icon="layers" label={t('chat.summarize')} onClick={() => actOnSelection('summarize')} />
            <button
              onClick={() => setSelection(null)}
              className="focusable rounded-lg p-1.5 text-[var(--text-3)] hover:bg-[var(--border)]"
              aria-label={t('common.close')}
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

    </article>
  );
}

function Act({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'focusable inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.74rem] font-semibold transition-all',
        'disabled:opacity-40 disabled:pointer-events-none',
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
          : 'text-[var(--text-3)] opacity-70 hover:bg-[var(--border)] hover:text-[var(--text)] hover:opacity-100 group-hover/msg:opacity-100',
      )}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SelBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focusable inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.76rem] font-semibold text-[var(--text-2)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Dot({ delay = '0s' }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
      style={{ animation: `blink 1.1s ${delay} infinite` }}
    />
  );
}
