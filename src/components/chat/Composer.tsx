import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n';
import { useChat, type PendingAttachment } from '../../store/chat';
import { usePendingAttachments } from '../../store/attachments';
import { useSettings } from '../../store/settings';
import { useProviders } from '../../store/providers';
import { useUI } from '../../store/ui';
import { classify, extract, MAX_FILE_BYTES, MAX_IMAGE_BYTES } from '../../lib/attach';
import { formatBytes, uid } from '../../lib/utils';
import { PROVIDER_MAP } from '../../ai/types';
import type { ReasoningLevel } from '../../ai/types';
import { cn } from '../../lib/utils';
import { Badge, Icon } from '../ui';
import { Dropdown, MenuItem } from '../ui/overlays';
import { VendorLogo } from '../Logo';

export default function Composer({ autoFocus = true }: { autoFocus?: boolean }) {
  const { t } = useI18n();
  const settings = useSettings();
  const toast = useUI((s) => s.toast);
  const providers = useProviders();

  const streaming = useChat((s) => s.streaming);
  const model = useChat((s) => s.model);
  const webSearch = useChat((s) => s.webSearch);
  const deepResearch = useChat((s) => s.deepResearch);
  const reasoning = useChat((s) => s.reasoning);
  const temporary = useChat((s) => s.temporary);
  const projectId = useChat((s) => s.projectId);
  const setOption = useChat((s) => s.setOption);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);

  const [value, setValue] = useState('');
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // files handed over from the Library arrive here
  useEffect(() => {
    const queued = usePendingAttachments.getState().drain();
    if (queued.length) setPending((p) => [...p, ...queued]);
  }, []);

  const models = providers.models;
  const selected = models.find((m) => m.id === model) ?? models[0];
  const vision = selected ? selected.capabilities.includes('vision') : false;
  const imageCount = pending.filter((a) => a.kind === 'image').length;

  const canSend = useMemo(
    () => Boolean(value.trim() || pending.length) && !streaming,
    [value, pending, streaming],
  );

  // auto-grow
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const kind = classify(file.name, file.type);
      const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
      if (file.size > limit) {
        toast(`${t('chat.fileTooLarge')} — ${file.name} (${formatBytes(file.size)})`, 'error');
        continue;
      }
      if (kind === 'image' && imageCount > 0 && !vision) {
        toast(t('chat.visionOnly'), 'error');
        continue;
      }
      const item: PendingAttachment = {
        id: uid(),
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        kind,
      };
      setPending((p) => [...p, item]);
      try {
        const res = await extract(file, kind);
        setPending((p) =>
          p.map((a) => (a.id === item.id ? { ...a, text: res.text, dataUrl: res.dataUrl } : a)),
        );
        if (res.note === 'image-too-large') toast(t('chat.fileTooLarge'), 'error');
      } catch {
        toast(t('chat.errorGeneric'), 'error');
      }
    }
  };

  const doSend = async () => {
    if (!canSend) return;
    if (imageCount > 0 && !vision) {
      toast(t('chat.visionOnly'), 'error');
      return;
    }
    const text = value.trim();
    const attachments = pending;
    setValue('');
    setPending([]);
    try {
      await send({ text, attachments });
    } catch {
      /* the store surfaces its own error state */
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (!settings.enterToSend) return;
    if (e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void doSend();
  };

  return (
    <div className="relative px-3 pb-3 sm:px-6 sm:pb-5">
      {projectId && (
        <div className="mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[0.74rem] text-[var(--text-2)]">
          <Icon name="folder" className="h-3 w-3" /> {t('projects.active')}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'relative rounded-2xl border bg-[var(--panel)] backdrop-blur-xl transition-colors',
          dragging ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-[var(--border)]',
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[0.86rem] font-bold text-[var(--accent-text)]">
            {t('library.dropHere')}
          </div>
        )}

        {/* attachment previews */}
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-[var(--border)] p-2.5">
            {pending.map((a) => (
              <span
                key={a.id}
                className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] py-1.5 pe-1.5 ps-2.5 text-[0.78rem]"
              >
                {a.kind === 'image' && a.dataUrl ? (
                  <img src={a.dataUrl} alt="" className="h-7 w-7 rounded object-cover" />
                ) : (
                  <Icon name="file" className="h-3.5 w-3.5 text-[var(--text-3)]" />
                )}
                <span className="max-w-[9rem] truncate text-[var(--text-2)]">{a.name}</span>
                {!a.text && a.kind !== 'image' && (
                  <span className="text-[0.66rem] text-[var(--text-3)]">…</span>
                )}
                <button
                  onClick={() => setPending((p) => p.filter((x) => x.id !== a.id))}
                  aria-label={t('common.remove')}
                  className="focusable rounded p-1 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--danger)]"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          rows={1}
          placeholder={t('chat.placeholder')}
          className="block max-h-[13.75rem] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[0.95rem] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
        />

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <TB icon="upload" label={t('chat.attach')} onClick={() => fileRef.current?.click()} />

          {/* model picker */}
          <Dropdown
            align="start"
            width="w-[22rem] max-w-[calc(100vw-3rem)]"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  'focusable flex h-8 items-center gap-2 rounded-lg border px-2 text-[0.78rem] font-semibold transition-colors',
                  open
                    ? 'border-[var(--accent)] text-[var(--accent-text)]'
                    : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
                )}
              >
                {selected ? (
                  <>
                    <VendorLogo
                      name={selected.name}
                      slug={PROVIDER_MAP[selected.provider]?.icon ?? selected.provider}
                      color={PROVIDER_MAP[selected.provider]?.color ?? '#4C7DFF'}
                      size={16}
                      rounded="rounded"
                    />
                    <span className="max-w-[8rem] truncate">{selected.name}</span>
                  </>
                ) : (
                  <span>{t('models.emptyConnected')}</span>
                )}
                <Icon name="chevronDown" className="h-3 w-3" />
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-72 overflow-y-auto">
                {models.length === 0 && (
                  <p className="px-3 py-4 text-center text-[0.8rem] text-[var(--text-3)]">
                    {t('models.emptyConnected')}
                  </p>
                )}
                {models.map((m) => (
                  <MenuItem
                    key={m.id}
                    onClick={() => {
                      setOption('model', m.id);
                      close();
                    }}
                  >
                    <span className="flex w-full items-center gap-2">
                      <VendorLogo
                        name={m.name}
                        slug={PROVIDER_MAP[m.provider]?.icon ?? m.provider}
                        color={PROVIDER_MAP[m.provider]?.color ?? '#4C7DFF'}
                        size={16}
                        rounded="rounded"
                      />
                      <span className="flex-1 truncate">{m.name}</span>
                      {m.id === model && <Icon name="check" className="h-3.5 w-3.5" />}
                    </span>
                  </MenuItem>
                ))}
              </div>
            )}
          </Dropdown>

          {/* toggles */}
          <TB
            icon="search"
            label={t('chat.webSearch')}
            active={webSearch}
            onClick={() => setOption('webSearch', !webSearch)}
          />
          <TB
            icon="book"
            label={t('chat.deepResearch')}
            active={deepResearch}
            onClick={() => setOption('deepResearch', !deepResearch)}
            disabled={!webSearch}
          />

          <Dropdown
            align="start"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  'focusable flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[0.78rem] font-semibold transition-colors',
                  open || reasoning !== 'balanced'
                    ? 'border-[var(--accent)] text-[var(--accent-text)]'
                    : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
                )}
              >
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                {t(`chat.reasoning.${reasoning}` as 'chat.reasoning.fast')}
              </button>
            )}
          >
            {(close) => (
              <>
                {(['fast', 'balanced', 'advanced'] as ReasoningLevel[]).map((r) => {
                  const supported = !selected || selected.capabilities.includes('reasoning');
                  return (
                    <MenuItem
                      key={r}
                      disabled={!supported}
                      onClick={() => {
                        setOption('reasoning', r);
                        close();
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="flex-1">{t(`chat.reasoning.${r}` as 'chat.reasoning.fast')}</span>
                        {!supported && <Badge tone="neutral">{t('cap.reasoning')}</Badge>}
                        {reasoning === r && <Icon name="check" className="h-3.5 w-3.5" />}
                      </span>
                    </MenuItem>
                  );
                })}
              </>
            )}
          </Dropdown>

          <TB
            icon="clock"
            label={t('chat.enableTemp')}
            active={temporary}
            onClick={() => setOption('temporary', !temporary)}
          />

          <div className="ms-auto flex items-center gap-2">
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-strong)] text-[var(--text)] transition-all hover:bg-[var(--border)]"
                aria-label={t('chat.stop')}
                title={t('chat.stop')}
              >
                <Icon name="stop" className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void doSend()}
                disabled={!canSend}
                aria-label={t('home.send')}
                title={t('home.send')}
                className={cn(
                  'focusable flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                  canSend
                    ? 'bg-[var(--accent)] text-white shadow-[0_6px_18px_-8px_var(--accent)] hover:brightness-110'
                    : 'bg-[var(--border)] text-[var(--text-3)]',
                )}
              >
                <Icon name="arrowUp" className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {models.length === 0 && (
        <p className="mt-1.5 text-center text-[0.68rem] leading-snug text-[var(--text-3)]">
          {t('chat.notConfiguredBody')}
        </p>
      )}
    </div>
  );
}

function TB({
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
      aria-pressed={active}
      className={cn(
        'focusable flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.78rem] font-semibold transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
          : 'text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]',
      )}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
