import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useProviders } from '../store/providers';
import { useUI } from '../store/ui';
import { gateway, GatewayError } from '../lib/gateway';
import { files as filesWs } from '../lib/workspace';
import { classify, extract, MAX_IMAGE_BYTES } from '../lib/attach';
import { PROVIDER_MAP, type ModelInfo } from '../ai/types';
import { Badge, Button, Icon, Select, Textarea } from '../components/ui';
import { VendorLogo } from '../components/Logo';
import { cn, formatDate, uid } from '../lib/utils';

interface Generated {
  id: string;
  url: string;
  prompt: string;
  model: string;
  size: string;
  at: number;
}

const SIZES = ['1024x1024', '1536x1024', '1024x1536', '512x512'];
const QUALITIES = ['low', 'medium', 'high', 'hd'];

export default function ImageStudioPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useUI((s) => s.toast);

  const models = useProviders((s) => s.models);
  const health = useProviders((s) => s.health);

  const imageModels = useMemo(
    () => models.filter((m) => m.capabilities.includes('imageGen') || m.capabilities.includes('imageEdit')),
    [models],
  );

  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(SIZES[0]);
  const [quality, setQuality] = useState('high');
  const [count, setCount] = useState(1);
  const [editImage, setEditImage] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Generated[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const model: ModelInfo | undefined = imageModels.find((m) => m.id === modelId) ?? imageModels[0];
  const params = (model?.parameters ?? []).map((p) => p.toLowerCase());
  const has = (alias: string[]) => params.some((p) => alias.includes(p));
  const supportsSize = has(['size', 'image_size', 'aspect_ratio']);
  const supportsQuality = has(['quality']);
  const supportsCount = has(['n', 'num_images', 'number_of_images', 'images']);
  const supportsEdit = Boolean(model?.capabilities.includes('imageEdit'));

  const pickFile = async (file: File) => {
    if (classify(file.name, file.type) !== 'image') {
      toast(t('images.editUnsupported'), 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast(t('chat.fileTooLarge'), 'error');
      return;
    }
    const res = await extract(file, 'image');
    if (res.dataUrl) setEditImage({ url: res.dataUrl, name: file.name });
  };

  const generate = async () => {
    if (!prompt.trim() || !model) return;
    setBusy(true);
    try {
      const res = await gateway.images.generate({
        model: model.id,
        provider: model.provider,
        prompt: prompt.trim(),
        ...(supportsSize ? { size } : {}),
        ...(supportsQuality ? { quality } : {}),
        ...(supportsCount ? { n: count } : {}),
        ...(editImage && supportsEdit ? { image: editImage.url } : {}),
      });
      const items = (res.images ?? []).map((img, i) => ({
        id: uid(),
        url: img.url ?? `data:image/png;base64,${img.b64 ?? ''}`,
        prompt: prompt.trim(),
        model: model.name,
        size,
        at: Date.now() + i,
      }));
      if (!items.length) toast(t('chat.errorGeneric'), 'error');
      setHistory((h) => [...items, ...h]);
    } catch (e) {
      const msg =
        e instanceof GatewayError
          ? e.kind === 'notConfigured'
            ? t('providers.gatewayRequired')
            : e.message
          : (e as Error).message;
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveToLibrary = async (item: Generated) => {
    const isData = item.url.startsWith('data:');
    const bytes = isData ? Math.floor((item.url.length - item.url.indexOf(',') - 1) * 0.75) : 0;
    await filesWs.save({
      id: uid(),
      name: `image-${new Date(item.at).toISOString().slice(0, 19).replace(/[:T]/g, '')}.png`,
      folderId: null,
      size: bytes,
      mime: 'image/png',
      kind: 'image',
      path: `studio/${uid()}.png`,
      url: item.url,
      createdAt: Date.now(),
    });
    toast(t('images.saved'), 'success');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('images.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] text-[var(--text-2)]">{t('images.sub')}</p>
        </header>

        {imageModels.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Icon name="image" className="h-5 w-5" />
            </span>
            <p className="text-[0.95rem] font-bold text-[var(--text)]">
              {health ? t('images.noModel') : t('common.setupRequired')}
            </p>
            <p className="max-w-md text-[0.84rem] leading-relaxed text-[var(--text-3)]">
              {health ? t('images.sub') : t('providers.gatewayRequired')}
            </p>
            <Button variant="primary" onClick={() => navigate('/providers')} icon="puzzle">
              {t('images.connectProvider')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
            {/* controls */}
            <section className="card h-fit p-4">
              <label className="mb-3 block">
                <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                  {t('models.filterImageGen')}
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                  <VendorLogo
                    name={model?.name ?? ''}
                    slug={(model && PROVIDER_MAP[model.provider]?.icon) || 'openai'}
                    color={(model && PROVIDER_MAP[model.provider]?.color) || '#4C7DFF'}
                    size={22}
                    rounded="rounded"
                  />
                  <select
                    value={model?.id ?? ''}
                    onChange={(e) => setModelId(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[0.85rem] font-semibold text-[var(--text)] outline-none"
                  >
                    {imageModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[0.82rem] font-semibold text-[var(--text-2)]">
                  {t('images.prompt')}
                </span>
                <Textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('images.promptPlaceholder')}
                />
              </label>

              {(supportsSize || supportsQuality || supportsCount) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {supportsSize && (
                    <label className="block">
                      <span className="mb-1 block text-[0.76rem] font-semibold text-[var(--text-2)]">
                        {t('images.size')}
                      </span>
                      <Select value={size} onChange={(e) => setSize(e.target.value)} className="py-2">
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {supportsQuality && (
                    <label className="block">
                      <span className="mb-1 block text-[0.76rem] font-semibold text-[var(--text-2)]">
                        {t('images.quality')}
                      </span>
                      <Select value={quality} onChange={(e) => setQuality(e.target.value)} className="py-2">
                        {QUALITIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {supportsCount && (
                    <label className="block">
                      <span className="mb-1 block text-[0.76rem] font-semibold text-[var(--text-2)]">
                        {t('images.count')}
                      </span>
                      <Select
                        value={String(count)}
                        onChange={(e) => setCount(Number(e.target.value))}
                        className="py-2"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                </div>
              )}

              {supportsEdit && (
                <div className="mt-3">
                  <span className="mb-1.5 block text-[0.78rem] font-semibold text-[var(--text-2)]">
                    {t('images.uploadEdit')}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void pickFile(f);
                      e.target.value = '';
                    }}
                  />
                  {editImage ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2">
                      <img src={editImage.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[0.78rem] text-[var(--text-2)]">
                        {editImage.name}
                      </span>
                      <button
                        onClick={() => setEditImage(null)}
                        className="focusable rounded p-1.5 text-[var(--text-3)] hover:text-[var(--danger)]"
                        aria-label={t('common.remove')}
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="focusable flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-3 text-[0.8rem] text-[var(--text-3)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                    >
                      <Icon name="upload" className="h-4 w-4" /> {t('library.upload')}
                    </button>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                className="mt-4 w-full"
                size="lg"
                loading={busy}
                disabled={!prompt.trim()}
                onClick={() => void generate()}
                icon="sparkles"
              >
                {busy ? t('images.generating') : t('images.generate')}
              </Button>

              {!supportsSize && (
                <p className="mt-2 flex items-start gap-1.5 text-[0.72rem] leading-relaxed text-[var(--text-3)]">
                  <Icon name="info" className="mt-0.5 h-3 w-3 shrink-0" />
                  {t('images.editUnsupported')}
                </p>
              )}
            </section>

            {/* results */}
            <section>
              <header className="mb-3 flex items-center gap-2">
                <h2 className="flex-1 text-[0.95rem] font-bold text-[var(--text)]">{t('images.history')}</h2>
                <Badge tone="neutral">{history.length}</Badge>
              </header>

              {history.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <Icon name="image" className="h-6 w-6 text-[var(--text-3)]" />
                  <p className="text-[0.86rem] text-[var(--text-3)]">{t('images.empty')}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {history.map((item) => (
                    <figure key={item.id} className="card group overflow-hidden p-0">
                      <img
                        src={item.url}
                        alt={item.prompt}
                        className="aspect-square w-full bg-[var(--panel-2)] object-cover"
                      />
                      <figcaption className="border-t border-[var(--border)] p-3">
                        <p className="line-clamp-2 text-[0.78rem] leading-relaxed text-[var(--text-2)]">
                          {item.prompt}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.68rem] text-[var(--text-3)]">
                          <span>{item.model}</span>
                          <span>· {item.size}</span>
                          <span>· {formatDate(item.at, lang)}</span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            icon="bookmark"
                            onClick={() => void saveToLibrary(item)}
                          >
                            {t('images.saveToLibrary')}
                          </Button>
                          <a
                            href={item.url}
                            download={`image-${item.id}.png`}
                            className={cn(
                              'focusable inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.82rem] font-semibold',
                              'text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--text)]',
                            )}
                          >
                            <Icon name="download" className="h-3.5 w-3.5" />
                            {t('common.download')}
                          </a>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
