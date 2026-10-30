import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useUI } from '../store/ui';
import { usePendingAttachments } from '../store/attachments';
import {
  files as filesWs,
  folders as foldersWs,
  uploads as uploadsWs,
  type FileDoc,
  type FolderDoc,
} from '../lib/workspace';
import { useFiles, useFolders } from '../lib/hooks';
import { classify, extract, MAX_FILE_BYTES } from '../lib/attach';
import { Badge, Button, Icon, Input } from '../components/ui';
import { Dropdown, MenuItem, Modal, ConfirmDialog } from '../components/ui/overlays';
import { cn, downloadText, formatBytes, formatDate, uid } from '../lib/utils';

const TYPE_TONE: Record<string, 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'> = {
  image: 'ok',
  pdf: 'danger',
  text: 'accent',
  code: 'accent',
  sheet: 'warn',
  doc: 'neutral',
  other: 'neutral',
};

export default function LibraryPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useUI((s) => s.toast);

  const files = useFiles();
  const folders = useFolders();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<FileDoc | null>(null);
  const [renaming, setRenaming] = useState<FileDoc | null>(null);
  const [moving, setMoving] = useState<FileDoc | null>(null);
  const [deleting, setDeleting] = useState<FileDoc | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return files
      .filter((f) => (f.folderId ?? null) === folderId)
      .filter((f) => !term || f.name.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [files, folderId, q]);

  const visibleFolders = useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === folderId).sort((a, b) => a.name.localeCompare(b.name)),
    [folders, folderId],
  );

  const usedBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const current = folders.find((f) => f.id === folderId) ?? null;

  const upload = async (list: FileList | File[]) => {
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        toast(`${t('chat.fileTooLarge')} — ${file.name}`, 'error');
        continue;
      }
      try {
        const { url, path } = await uploadsWs.add(file);
        const kind = classify(file.name, file.type);
        await filesWs.save({
          id: uid(),
          name: file.name,
          folderId,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          kind,
          path,
          url,
          createdAt: Date.now(),
        });
      } catch (e) {
        toast(`${file.name}: ${(e as Error).message}`, 'error');
      }
    }
    setBusy(false);
  };

  const attach = async (f: FileDoc) => {
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const file = new File([blob], f.name, { type: f.mime || blob.type });
      const kind = classify(f.name, file.type);
      const ex = await extract(file, kind);
      usePendingAttachments.getState().add({
        id: uid(),
        name: f.name,
        size: f.size,
        mime: f.mime,
        kind,
        text: ex.text,
        dataUrl: ex.dataUrl,
      });
      navigate('/chat');
    } catch {
      toast(t('chat.errorNetwork'), 'error');
    }
  };

  const download = (f: FileDoc) => {
    if (f.url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = f.url;
      link.download = f.name;
      link.click();
    } else if (f.mime.startsWith('text/') || f.kind === 'code' || f.kind === 'text') {
      void fetch(f.url)
        .then((r) => r.text())
        .then((body) => downloadText(f.name, body));
    } else {
      const link = document.createElement('a');
      link.href = f.url;
      link.download = f.name;
      link.target = '_blank';
      link.click();
    }
  };

  useEffect(() => {
    document.body.style.overflow = dragging ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [dragging]);

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) void upload(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[var(--accent-soft)] backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-[var(--accent)] px-8 py-6 text-[1rem] font-bold text-[var(--accent-text)]">
            {t('library.dropHere')}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('library.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('library.sub')}</p>
        </header>

        {/* controls */}
        <div className="card mb-4 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              wrapClassName="min-w-[13rem] flex-1"
            />
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = '';
              }}
            />
            <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()} icon="upload" loading={busy}>
              {t('library.upload')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewFolder(true)} icon="folder">
              {t('library.newFolder')}
            </Button>
          </div>

          {/* breadcrumb */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.78rem] text-[var(--text-3)]">
            <button
              onClick={() => setFolderId(null)}
              className={cn(
                'focusable rounded px-1.5 py-0.5 hover:bg-[var(--border)] hover:text-[var(--text)]',
                folderId === null && 'font-bold text-[var(--accent-text)]',
              )}
            >
              {t('library.title')}
            </button>
            {current && (
              <>
                <Icon name="chevronRight" className="h-3 w-3 rtl:rotate-180" />
                <span className="font-bold text-[var(--text-2)]">{current.name}</span>
              </>
            )}
            <span className="ms-auto text-[0.72rem]">
              {files.length} {t('common.name')} · {formatBytes(usedBytes)} {t('library.used')}
            </span>
          </div>
        </div>

        {/* folders */}
        {visibleFolders.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {visibleFolders.map((f) => (
              <FolderTile key={f.id} folder={f} onOpen={() => setFolderId(f.id)} onDelete={() => void foldersWs.remove(f.id)} />
            ))}
          </div>
        )}

        {/* files */}
        {visible.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Icon name="book" className="h-5 w-5" />
            </span>
            <p className="text-[0.95rem] font-bold text-[var(--text)]">{t('library.empty')}</p>
            <p className="max-w-sm text-[0.84rem] leading-relaxed text-[var(--text-3)]">{t('library.emptySub')}</p>
            <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()} icon="upload">
              {t('library.upload')}
            </Button>
          </div>
        ) : (
          <ul className="grid gap-2">
            {visible.map((f) => (
              <li
                key={f.id}
                className="card group flex items-center gap-3 p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              >
                <FileIcon file={f} />

                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setPreview(f)}
                    className="focusable block max-w-full truncate text-start text-[0.88rem] font-semibold text-[var(--text)] hover:text-[var(--accent-text)] hover:underline"
                  >
                    {f.name}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.72rem] text-[var(--text-3)]">
                    <span>{formatBytes(f.size)}</span>
                    <span>· {formatDate(f.createdAt, lang)}</span>
                    <Badge tone={TYPE_TONE[f.kind] ?? 'neutral'}>{f.kind.toUpperCase()}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setPreview(f)}
                    title={t('library.preview')}
                    className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    <Icon name="eye" className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void attach(f)}
                    title={t('library.attachToChat')}
                    className="focusable rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--accent-text)]"
                  >
                    <Icon name="send" className="h-4 w-4" />
                  </button>
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
                          icon="download"
                          onClick={() => {
                            close();
                            download(f);
                          }}
                        >
                          {t('library.download')}
                        </MenuItem>
                        <MenuItem
                          icon="edit"
                          onClick={() => {
                            close();
                            setRenaming(f);
                          }}
                        >
                          {t('common.rename')}
                        </MenuItem>
                        <MenuItem
                          icon="folder"
                          onClick={() => {
                            close();
                            setMoving(f);
                          }}
                        >
                          {t('library.moveTo')}
                        </MenuItem>
                        <MenuItem
                          icon="trash"
                          danger
                          onClick={() => {
                            close();
                            setDeleting(f);
                          }}
                        >
                          {t('common.delete')}
                        </MenuItem>
                      </>
                    )}
                  </Dropdown>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* preview */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ''}
        size="lg"
        footer={
          preview && (
            <>
              <Button variant="ghost" onClick={() => void attach(preview)} icon="send">
                {t('library.attachToChat')}
              </Button>
              <Button variant="primary" onClick={() => download(preview)} icon="download">
                {t('library.download')}
              </Button>
            </>
          )
        }
      >
        <PreviewBody file={preview} />
      </Modal>

      {/* rename */}
      <RenameModal
        file={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (renaming) await filesWs.rename(renaming.id, name);
          setRenaming(null);
        }}
      />

      {/* move */}
      <Modal
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={t('library.moveTo')}
        size="sm"
      >
        <div className="grid gap-1.5">
          <MoveOption label={t('library.title')} icon="book" onClick={() => void moveFile(null)} />
          {folders.map((f) => (
            <MoveOption
              key={f.id}
              label={f.name}
              icon="folder"
              onClick={() => void moveFile(f.id)}
            />
          ))}
        </div>
      </Modal>

      {/* new folder */}
      <Modal open={newFolder} onClose={() => setNewFolder(false)} title={t('library.newFolder')} size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolder(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!folderName.trim()) return;
                await foldersWs.save({
                  id: uid(),
                  name: folderName.trim(),
                  parentId: folderId,
                  createdAt: Date.now(),
                });
                setFolderName('');
                setNewFolder(false);
              }}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <Input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder={t('library.folderName')}
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title={t('library.deleteConfirm')}
        body={deleting?.name}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await filesWs.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );

  async function moveFile(target: string | null) {
    if (!moving) return;
    await filesWs.move(moving.id, target);
    setMoving(null);
  }
}

/* -------------------------------- helpers -------------------------------- */

function FolderTile({ folder, onOpen, onDelete }: { folder: FolderDoc; onOpen: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card group flex items-center gap-2.5 p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]">
      <button onClick={onOpen} className="focusable flex min-w-0 flex-1 items-center gap-2.5 text-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Icon name="folder" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.85rem] font-bold text-[var(--text)]">{folder.name}</span>
          <span className="block text-[0.7rem] text-[var(--text-3)]">{formatDate(folder.createdAt, 'en')}</span>
        </span>
      </button>
      <button
        onClick={onDelete}
        title={t('common.delete')}
        className="focusable rounded p-1.5 text-[var(--text-3)] opacity-0 transition-opacity hover:text-[var(--danger)] group-hover:opacity-100"
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileIcon({ file }: { file: FileDoc }) {
  const map: Record<string, { icon: string; cls: string }> = {
    image: { icon: 'image', cls: 'bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-[var(--ok)]' },
    pdf: { icon: 'file', cls: 'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]' },
    text: { icon: 'file', cls: 'bg-[var(--accent-soft)] text-[var(--accent-text)]' },
    code: { icon: 'code', cls: 'bg-[var(--accent-soft)] text-[var(--accent-text)]' },
    sheet: { icon: 'grid', cls: 'bg-[color-mix(in_srgb,#f5a524_16%,transparent)] text-[#f5a524]' },
  };
  const m = map[file.kind] ?? { icon: 'file', cls: 'bg-[var(--border)] text-[var(--text-2)]' };
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', m.cls)}>
      <Icon name={m.icon} className="h-4.5 w-4.5 h-[1.125rem] w-[1.125rem]" />
    </span>
  );
}

function PreviewBody({ file }: { file: FileDoc | null }) {
  const { t } = useI18n();
  const [text, setText] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setText('');
    setFailed(false);
    if (!file) return;
    if (file.kind === 'text' || file.kind === 'code' || file.mime.startsWith('text/')) {
      if (file.url.startsWith('data:')) {
        try {
          setText(decodeURIComponent(escape(atob(file.url.split(',')[1] ?? ''))));
        } catch {
          void fetch(file.url)
            .then((r) => r.text())
            .then(setText)
            .catch(() => setFailed(true));
        }
      } else {
        void fetch(file.url)
          .then((r) => r.text())
          .then(setText)
          .catch(() => setFailed(true));
      }
    }
  }, [file]);

  if (!file) return null;

  if (file.kind === 'image')
    return failed ? (
      <p className="py-6 text-center text-[var(--text-3)]">{t('error.title')}</p>
    ) : (
      <img src={file.url} alt={file.name} onError={() => setFailed(true)} className="mx-auto max-h-[60vh] rounded-xl" />
    );

  if (file.mime === 'application/pdf' || file.kind === 'pdf')
    return <iframe title={file.name} src={file.url} className="h-[60vh] w-full rounded-xl border border-[var(--border)]" />;

  if (file.kind === 'text' || file.kind === 'code' || file.mime.startsWith('text/'))
    return (
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4 font-mono text-[0.8rem] leading-relaxed text-[var(--text)]">
        {text || (failed ? t('error.title') : '…')}
      </pre>
    );

  return (
    <div className="flex flex-col items-center gap-2 py-8 text-[var(--text-3)]">
      <Icon name="file" className="h-8 w-8" />
      <p className="text-[0.85rem]">{file.mime}</p>
      <p className="text-[0.78rem]">{t('library.preview')}</p>
    </div>
  );
}

function MoveOption({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focusable flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-[0.88rem] font-medium text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]"
    >
      <Icon name={icon} className="h-4 w-4 text-[var(--accent-text)]" />
      {label}
    </button>
  );
}

function RenameModal({
  file,
  onClose,
  onSave,
}: {
  file: FileDoc | null;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  useEffect(() => setValue(file?.name ?? ''), [file]);
  if (!file) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('common.rename')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onSave(value.trim() || file.name)}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
    </Modal>
  );
}
