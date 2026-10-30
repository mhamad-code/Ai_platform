import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useProjects } from '../store/projects';
import { useChat } from '../store/chat';
import { useProviders } from '../store/providers';
import { useUI } from '../store/ui';
import { useFiles } from '../lib/hooks';
import type { ProjectDoc } from '../lib/db';
import { PROVIDER_MAP } from '../ai/types';
import { VendorLogo } from '../components/Logo';
import { Badge, Button, Icon, Input, Textarea } from '../components/ui';
import { Modal } from '../components/ui/overlays';
import { ConfirmDialog } from '../components/ui/overlays';
import { cn, formatDate, relativeTime, truncate } from '../lib/utils';

export default function ProjectsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useUI((s) => s.toast);

  const projects = useProjects((s) => s.projects);
  const activeId = useProjects((s) => s.activeId);
  const setActive = useProjects((s) => s.setActive);
  const watch = useProjects((s) => s.watch);
  const create = useProjects((s) => s.create);
  const update = useProjects((s) => s.update);
  const remove = useProjects((s) => s.remove);
  const linkFile = useProjects((s) => s.linkFile);
  const unlinkFile = useProjects((s) => s.unlinkFile);
  const toggleModel = useProjects((s) => s.toggleModel);

  const chats = useChat((s) => s.chats);
  const setChatOption = useChat((s) => s.setOption);
  const models = useProviders((s) => s.models);
  const files = useFiles();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', instructions: '' });
  const [deleting, setDeleting] = useState<ProjectDoc | null>(null);
  const [tab, setTab] = useState<'instructions' | 'files' | 'chats' | 'models'>('instructions');

  useEffect(() => watch(), [watch]);

  const active = projects.find((p) => p.id === activeId) ?? null;
  const linkedChats = useMemo(() => chats.filter((c) => c.projectId === activeId), [chats, activeId]);

  if (active) {
    const linkedFiles = files.filter((f) => active.fileIds.includes(f.id));

    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-6 sm:px-6">
          <button
            onClick={() => setActive(null)}
            className="focusable mb-4 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
          >
            <Icon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" /> {t('projects.title')}
          </button>

          <header className="card mb-4 flex flex-wrap items-start gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Icon name="folder" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[1.3rem] font-extrabold tracking-tight text-[var(--text)]">{active.name}</h1>
              <p className="mt-0.5 text-[0.85rem] text-[var(--text-2)]">{active.description || '—'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{linkedChats.length} {t('projects.chats')}</Badge>
                <Badge tone="neutral">{linkedFiles.length} {t('projects.files')}</Badge>
                <Badge tone="neutral">{active.modelIds.length} {t('projects.models')}</Badge>
                <Badge tone="accent">{formatDate(active.updatedAt, lang)}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  setChatOption('projectId', active.id);
                  navigate('/chat');
                }}
              >
                {t('projects.open')}
              </Button>
              <Button variant="ghost" icon="trash" onClick={() => setDeleting(active)} aria-label={t('common.delete')} />
            </div>
          </header>

          <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
            {(
              [
                ['instructions', t('projects.instructions')],
                ['files', t('projects.files')],
                ['chats', t('projects.chats')],
                ['models', t('projects.models')],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  'focusable whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.84rem] font-semibold transition-colors',
                  tab === k
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="card p-5">
            {tab === 'instructions' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                    {t('projects.name')}
                  </span>
                  <Input
                    value={active.name}
                    onChange={(e) => update(active.id, { name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                    {t('projects.desc')}
                  </span>
                  <Input
                    value={active.description}
                    onChange={(e) => update(active.id, { description: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                    {t('projects.instructions')}
                  </span>
                  <Textarea
                    rows={7}
                    value={active.instructions}
                    placeholder={t('projects.instructionsHint')}
                    onChange={(e) => update(active.id, { instructions: e.target.value })}
                  />
                  <span className="mt-1 block text-[0.75rem] text-[var(--text-3)]">
                    {t('projects.instructionsHint')}
                  </span>
                </label>
              </div>
            )}

            {tab === 'files' && (
              <div>
                <p className="mb-3 text-[0.83rem] text-[var(--text-3)]">{t('projects.files')}</p>
                {files.length === 0 ? (
                  <p className="py-6 text-center text-[0.85rem] text-[var(--text-3)]">{t('library.empty')}</p>
                ) : (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {files.map((f) => {
                      const on = active.fileIds.includes(f.id);
                      return (
                        <li key={f.id}>
                          <button
                            onClick={() => (on ? unlinkFile(active.id, f.id) : linkFile(active.id, f.id))}
                            className={cn(
                              'focusable flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-start transition-colors',
                              on
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                : 'border-[var(--border)] hover:bg-[var(--border)]',
                            )}
                          >
                            <Icon name={f.kind === 'image' ? 'image' : 'file'} className="h-4 w-4 text-[var(--text-3)]" />
                            <span className="min-w-0 flex-1 truncate text-[0.84rem] text-[var(--text)]">{f.name}</span>
                            <Icon
                              name={on ? 'check' : 'plus'}
                              className={cn('h-4 w-4', on ? 'text-[var(--ok)]' : 'text-[var(--text-3)]')}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {tab === 'chats' && (
              <div>
                {linkedChats.length === 0 ? (
                  <p className="py-6 text-center text-[0.85rem] text-[var(--text-3)]">{t('chat.noChats')}</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {linkedChats.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => navigate(`/chat/${c.id}`)}
                          className="focusable flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start hover:bg-[var(--border)]"
                        >
                          <Icon name="layers" className="h-4 w-4 text-[var(--accent-text)]" />
                          <span className="min-w-0 flex-1 truncate text-[0.85rem] text-[var(--text)]">{c.title}</span>
                          <span className="text-[0.72rem] text-[var(--text-3)]">
                            {relativeTime(c.updatedAt, lang)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[0.76rem] text-[var(--text-3)]">
                  {t('chat.moveToProject')} → {active.name}
                </p>
              </div>
            )}

            {tab === 'models' && (
              <div>
                {models.length === 0 ? (
                  <p className="py-6 text-center text-[0.85rem] text-[var(--text-3)]">{t('models.emptyConnected')}</p>
                ) : (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {models.map((m) => {
                      const on = active.modelIds.includes(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            onClick={() => toggleModel(active.id, m.id)}
                            className={cn(
                              'focusable flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-start transition-colors',
                              on
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                : 'border-[var(--border)] hover:bg-[var(--border)]',
                            )}
                          >
                            <VendorLogo
                              name={m.name}
                              slug={PROVIDER_MAP[m.provider]?.icon ?? m.provider}
                              color={PROVIDER_MAP[m.provider]?.color ?? '#4C7DFF'}
                              size={24}
                              rounded="rounded"
                            />
                            <span className="min-w-0 flex-1 truncate text-[0.84rem] text-[var(--text)]">{m.name}</span>
                            <Icon
                              name={on ? 'check' : 'plus'}
                              className={cn('h-4 w-4', on ? 'text-[var(--ok)]' : 'text-[var(--text-3)]')}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          <ConfirmDialog
            open={Boolean(deleting)}
            danger
            title={t('projects.deleteConfirm')}
            body={deleting?.name}
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              if (deleting) await remove(deleting.id);
              setDeleting(null);
              toast(t('common.delete'), 'success');
            }}
          />
        </div>
      </div>
    );
  }

  /* ------------------------------- list -------------------------------- */

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
              {t('projects.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('projects.sub')}</p>
          </div>
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('projects.new')}
          </Button>
        </header>

        {projects.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Icon name="folder" className="h-5 w-5" />
            </span>
            <p className="text-[0.95rem] font-bold text-[var(--text)]">{t('projects.empty')}</p>
            <p className="max-w-md text-[0.84rem] leading-relaxed text-[var(--text-3)]">{t('projects.sub')}</p>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>
              {t('projects.new')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <article
                key={p.id}
                className="card group flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              >
                <button
                  onClick={() => setActive(p.id)}
                  className="focusable flex items-start gap-3 text-start"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
                    <Icon name="folder" className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-bold text-[var(--text)] group-hover:text-[var(--accent-text)]">
                      {p.name}
                    </span>
                    <span className="mt-0.5 block text-[0.76rem] text-[var(--text-3)]">
                      {relativeTime(p.updatedAt, lang)}
                    </span>
                  </span>
                </button>

                <p className="mt-2 line-clamp-2 flex-1 text-[0.82rem] leading-relaxed text-[var(--text-2)]">
                  {truncate(p.description || p.instructions || '—', 120)}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{p.fileIds.length} {t('projects.files')}</Badge>
                  <Badge tone="neutral">{p.modelIds.length} {t('projects.models')}</Badge>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="soft"
                    size="sm"
                    className="flex-1"
                    icon="arrowUp"
                    onClick={() => {
                      setActive(p.id);
                    }}
                  >
                    {t('projects.open')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleting(p)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t('projects.new')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!form.name.trim()}
              onClick={async () => {
                const id = await create(form);
                setForm({ name: '', description: '', instructions: '' });
                setCreating(false);
                setActive(id);
                toast(t('projects.created'), 'success');
              }}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">{t('projects.name')}</span>
            <Input
              value={form.name}
              autoFocus
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">{t('projects.desc')}</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
              {t('projects.instructions')}
            </span>
            <Textarea
              rows={5}
              value={form.instructions}
              placeholder={t('projects.instructionsHint')}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
