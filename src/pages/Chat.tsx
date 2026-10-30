import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../store/chat';
import { useProviders } from '../store/providers';
import { useUI } from '../store/ui';
import { useI18n, type TranslationKey } from '../i18n';
import { ChatActionsContext } from '../components/Interactive';
import Message from '../components/chat/Message';
import Composer from '../components/chat/Composer';
import { Badge, Icon } from '../components/ui';
import { VendorLogo } from '../components/Logo';
import { PROVIDER_MAP } from '../ai/types';
import { Dropdown, MenuItem } from '../components/ui/overlays';
import { cn, relativeTime } from '../lib/utils';

const SUGGESTIONS: TranslationKey[] = [
  'home.suggest.writeArticle',
  'home.suggest.buildWebsite',
  'home.suggest.analyzePdf',
  'home.suggest.explainImage',
  'home.suggest.writeCode',
  'home.suggest.deepSearch',
  'home.suggest.projectPlan',
  'home.suggest.compare',
];

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const messages = useChat((s) => s.messages);
  const stream = useChat((s) => s.stream);
  const streaming = useChat((s) => s.streaming);
  const error = useChat((s) => s.error);
  const activeId = useChat((s) => s.activeId);
  const temporary = useChat((s) => s.temporary);
  const model = useChat((s) => s.model);
  const webSearch = useChat((s) => s.webSearch);
  const deepResearch = useChat((s) => s.deepResearch);
  const reasoning = useChat((s) => s.reasoning);
  const open = useChat((s) => s.open);
  const create = useChat((s) => s.create);
  const send = useChat((s) => s.send);
  const patchChat = useChat((s) => s.patchChat);
  const removeChat = useChat((s) => s.removeChat);
  const setOption = useChat((s) => s.setOption);

  const models = useProviders((s) => s.models);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentMeta = useChat((s) => s.chats.find((c) => c.id === (id ?? s.activeId)));
  const selectedModel = models.find((m) => m.id === model) ?? models[0];

  /* subscribe to the conversation */
  useEffect(() => {
    const stop = open(id ?? null);
    return stop;
  }, [id, open]);

  /* a chat created from the empty composer should get its URL */
  useEffect(() => {
    if (!id && activeId && !temporary) navigate(`/chat/${activeId}`, { replace: true });
  }, [id, activeId, temporary, navigate]);

  /* follow the stream */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, stream, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  const followUp = (text: string) => {
    void send({ text });
  };

  const empty = messages.length === 0 && !streaming && !stream;

  const actions = useMemo(() => ({ submit: followUp, busy: streaming }), [streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 backdrop-blur-xl sm:h-14 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {selectedModel && (
            <VendorLogo
              name={selectedModel.name}
              slug={PROVIDER_MAP[selectedModel.provider]?.icon ?? selectedModel.provider}
              color={PROVIDER_MAP[selectedModel.provider]?.color ?? '#4C7DFF'}
              size={24}
              rounded="rounded-md"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-[0.88rem] font-bold text-[var(--text)]">
              {currentMeta?.title ?? t('chat.new')}
            </div>
            <div className="flex items-center gap-1.5 text-[0.68rem] text-[var(--text-3)]">
              {selectedModel ? <span className="truncate">{selectedModel.name}</span> : t('models.emptyConnected')}
              {currentMeta && <span>· {relativeTime(currentMeta.updatedAt, lang)}</span>}
            </div>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-1.5">
          {temporary && <Badge tone="warn">{t('chat.enableTemp')}</Badge>}
          {webSearch && <Badge tone="accent">{t('chat.webSearch')}</Badge>}
          {deepResearch && <Badge tone="accent">{t('chat.deepResearch')}</Badge>}
          {reasoning !== 'balanced' && (
            <Badge tone="accent">{t(`chat.reasoning.${reasoning}` as 'chat.reasoning.fast')}</Badge>
          )}

          <button
            onClick={() => {
              void create({ title: lang === 'ar' ? 'محادثة جديدة' : 'New chat' });
              setOption('temporary', false);
              navigate('/chat');
            }}
            title={t('chat.new')}
            className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>

          {activeId && (
            <Dropdown
              align="end"
              trigger={({ toggle }) => (
                <button
                  onClick={toggle}
                  title={t('common.more')}
                  className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                >
                  <Icon name="chevronDown" className="h-4 w-4" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon="edit"
                    onClick={() => {
                      close();
                      const next = window.prompt(t('chat.renameChat'), currentMeta?.title ?? '');
                      if (next?.trim()) patchChat(activeId, { title: next.trim() });
                    }}
                  >
                    {t('common.rename')}
                  </MenuItem>
                  <MenuItem
                    icon="archive"
                    onClick={() => {
                      close();
                      patchChat(activeId, { archived: true });
                      useUI.getState().toast(t('chat.archived'), 'success');
                      navigate('/chat');
                    }}
                  >
                    {t('chat.archiveChat')}
                  </MenuItem>
                  <MenuItem
                    icon="trash"
                    danger
                    onClick={() => {
                      close();
                      setConfirmDelete(true);
                    }}
                  >
                    {t('chat.deleteChat')}
                  </MenuItem>
                </>
              )}
            </Dropdown>
          )}
        </div>
      </header>

      {temporary && (
        <div className="flex items-center justify-center gap-2 bg-[color-mix(in_srgb,#f5a524_14%,transparent)] px-4 py-1.5 text-center text-[0.74rem] font-semibold text-[#f5a524]">
          <Icon name="clock" className="h-3.5 w-3.5" /> {t('chat.tempNotice')}
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyConversation onPick={followUp} />
        ) : (
          <>
            <div className="mx-auto w-full max-w-3xl">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  msg={m}
                  onFollowUp={followUp}
                />
              ))}

              {streaming && (
                <div className="animate-floatUp">
                  <Message
                    streaming
                    onFollowUp={followUp}
                    msg={{
                      id: 'streaming',
                      role: 'assistant',
                      content: stream?.text ?? '',
                      createdAt: Date.now(),
                      model: model ?? undefined,
                      sources: stream?.sources ?? [],
                    }}
                  />
                </div>
              )}
            </div>

            {!atBottom && (messages.length > 1 || streaming) && (
              <button
                onClick={() => {
                  const el = scrollRef.current;
                  if (el) el.scrollTop = el.scrollHeight;
                  setAtBottom(true);
                }}
                className="focusable sticky bottom-3 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-solid)] text-[var(--text-2)] shadow-[var(--shadow)]"
                aria-label="scroll to bottom"
              >
                <Icon name="chevronDown" className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* not-configured banner */}
      {error === 'chat.notConfiguredTitle' && (
        <div className="mx-3 mb-2 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-3 sm:mx-6">
          <div className="flex items-start gap-2.5">
            <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a524]" />
            <div className="min-w-0 flex-1">
              <div className="text-[0.86rem] font-bold text-[var(--text)]">{t('chat.notConfiguredTitle')}</div>
              <p className="mt-0.5 text-[0.8rem] text-[var(--text-2)]">{t('chat.notConfiguredBody')}</p>
            </div>
            <button
              onClick={() => navigate('/providers')}
              className="focusable shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[0.78rem] font-bold text-white"
            >
              {t('chat.goProviders')}
            </button>
          </div>
        </div>
      )}

      {/* composer */}
      <ChatActionsContext.Provider value={actions}>
        <Composer />
      </ChatActionsContext.Provider>
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--panel-solid)] p-5 shadow-[var(--shadow)] animate-slideIn">
            <h3 className="text-[0.98rem] font-bold text-[var(--text)]">{t('chat.deleteChat')}</h3>
            <p className="mt-1.5 text-[0.85rem] text-[var(--text-2)]">{t('chat.deleteChat')}?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="focusable rounded-lg px-3 py-2 text-[0.85rem] font-semibold text-[var(--text-2)] hover:bg-[var(--border)]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  void (activeId ? removeChat(activeId) : Promise.resolve()).then(() => navigate('/chat'));
                }}
                className="focusable rounded-lg bg-[var(--danger)] px-4 py-2 text-[0.85rem] font-bold text-white"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- empty conversation -------------------------- */

function EmptyConversation({ onPick }: { onPick: (text: string) => void }) {
  const { t, lang } = useI18n();
  const models = useProviders((s) => s.models);
  const setModel = useChat((s) => s.setOption);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('home.greetingMorning') : hour < 18 ? t('home.greetingAfternoon') : t('home.greetingEvening');

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-[1.6rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[2rem]">
          {greeting}
        </h1>
        <p className="mt-1.5 text-[0.95rem] text-[var(--text-2)]">{t('home.whatWouldYouDo')}</p>
      </div>

      {models.length > 0 && (
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {models.slice(0, 6).map((m) => (
            <button
              key={m.id}
              onClick={() => setModel('model', m.id)}
              className={cn(
                'focusable flex items-center gap-2 rounded-xl border px-3 py-2 text-[0.82rem] font-semibold transition-all',
                (useChat.getState().model ?? models[0].id) === m.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--border-strong)]',
              )}
            >
              <VendorLogo
                name={m.name}
                slug={PROVIDER_MAP[m.provider]?.icon ?? m.provider}
                color={PROVIDER_MAP[m.provider]?.color ?? '#4C7DFF'}
                size={16}
                rounded="rounded"
              />
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((k, i) => (
          <button
            key={k}
            onClick={() => onPick(t(k))}
            className="focusable group card flex items-start gap-3 p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-white">
              <Icon name={['edit', 'globe', 'file', 'image', 'code', 'search', 'layers', 'grid'][i]} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.88rem] font-bold text-[var(--text)]">{t(k)}</span>
              <span className="mt-0.5 block truncate text-[0.76rem] text-[var(--text-3)]">
                {lang === 'ar' ? 'اضغط للبدء' : 'Tap to start'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
