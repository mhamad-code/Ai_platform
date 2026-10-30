import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n, type Lang } from '../i18n';
import { useSettings, type Scene, type Theme } from '../store/settings';
import { useAuth } from '../lib/auth';
import { useUI } from '../store/ui';
import { useProviders } from '../store/providers';
import { useProviderRows } from '../lib/hooks';
import {
  exportAll,
  clearHistory,
  workspace,
  userSettings as userSettingsWs,
  type SettingsDoc,
} from '../lib/workspace';
import { PROVIDERS } from '../ai/types';
import { tts } from '../lib/tts';
import { Badge, Button, Field, Icon, Input, Select, Slider, Switch } from '../components/ui';
import { ConfirmDialog, Modal } from '../components/ui/overlays';
import { VendorLogo } from '../components/Logo';
import { cn, downloadText } from '../lib/utils';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const s = useSettings();
  const { user, configured, signOut, updateName, changePassword, deleteAccount } = useAuth();
  const toast = useUI((st) => st.toast);
  const health = useProviders((st) => st.health);

  const [name, setName] = useState(user?.name ?? '');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => setName(user?.name ?? ''), [user]);

  const saveSettings = async (patch: Partial<SettingsDoc> & { voiceURI?: string }) => {
    s.setMany(patch);
    await userSettingsWs.save(patch as SettingsDoc);
  };

  const exportData = async () => {
    try {
      const data = await exportAll();
      downloadText(`ai-platform-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast(t('settings.exportData'), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-7 sm:px-6">
        <header className="mb-6">
          <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)] sm:text-[1.9rem]">
            {t('settings.title')}
          </h1>
        </header>

        <div className="space-y-5">
          {/* ------------------------------ appearance ------------------------------ */}
          <Section title={t('settings.appearance')} icon="sun">
            <Row label={t('settings.theme')}>
              <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-1">
                {(['dark', 'light'] as Theme[]).map((th) => (
                  <button
                    key={th}
                    onClick={() => void saveSettings({ theme: th })}
                    className={cn(
                      'focusable flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition-colors',
                      s.theme === th
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-2)] hover:bg-[var(--border)]',
                    )}
                  >
                    <Icon name={th === 'dark' ? 'moon' : 'sun'} className="h-3.5 w-3.5" />
                    {t(th === 'dark' ? 'settings.dark' : 'settings.light')}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={t('settings.language')}>
              <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-1">
                {(['ar', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={cn(
                      'focusable rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition-colors',
                      lang === l ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--border)]',
                    )}
                  >
                    {l === 'ar' ? 'العربية' : 'English'}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={t('settings.accent')}>
              <div className="flex flex-wrap gap-2">
                {['#4C7DFF', '#3DDC97', '#F5A524', '#FF6B6B', '#9B8CFF', '#4EC9E8'].map((c) => (
                  <button
                    key={c}
                    onClick={() => void saveSettings({ accent: c })}
                    aria-label={c}
                    className={cn(
                      'focusable h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      s.accent === c ? 'border-[var(--text)] scale-110' : 'border-transparent',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Row>

            <Row label={t('settings.fontSize')}>
              <div className="flex min-w-[14rem] flex-1 items-center gap-3">
                <Slider
                  value={s.fontSize}
                  min={14}
                  max={20}
                  step={1}
                  onChange={(v) => void saveSettings({ fontSize: v })}
                  format={(v) => `${v}px`}
                />
              </div>
            </Row>

            <Row label={t('settings.density')}>
              <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-1">
                {(['comfy', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => void saveSettings({ density: d })}
                    className={cn(
                      'focusable rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition-colors',
                      s.density === d ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--border)]',
                    )}
                  >
                    {t(`settings.density.${d}` as 'settings.density.comfy')}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={t('settings.motion')}>
              <Switch checked={s.motion} onChange={(v) => void saveSettings({ motion: v })} />
            </Row>

            <Row label={t('settings.background')}>
              <Select
                value={s.background}
                onChange={(e) => void saveSettings({ background: e.target.value as Scene })}
                className="w-auto min-w-[10rem]"
              >
                <option value="ridge">{t('settings.background.ridge')}</option>
                <option value="cliff">{t('settings.background.cliff')}</option>
                <option value="mist">{t('settings.background.mist')}</option>
              </Select>
            </Row>

            <Row label={t('settings.backgroundAnim')}>
              <Switch checked={s.backgroundAnim} onChange={(v) => void saveSettings({ backgroundAnim: v })} />
            </Row>
          </Section>

          {/* --------------------------------- chat -------------------------------- */}
          <Section title={t('settings.chat')} icon="layers">
            <Row label={t('settings.defaultModel')}>
              <ModelSelect
                value={s.defaultModel ?? ''}
                onChange={(v) => void saveSettings({ defaultModel: v || undefined })}
              />
            </Row>
            <Row label={t('settings.enterToSend')}>
              <Switch checked={s.enterToSend} onChange={(v) => void saveSettings({ enterToSend: v })} />
            </Row>
            <Row label={t('settings.markdown')}>
              <Switch checked={s.markdown} onChange={(v) => void saveSettings({ markdown: v })} />
            </Row>
            <Row label={t('settings.webSearchDefault')}>
              <Switch checked={s.webSearchDefault} onChange={(v) => void saveSettings({ webSearchDefault: v })} />
            </Row>
            <Row label={t('settings.speakVoice')}>
              <Select
                value={s.voiceURI}
                onChange={(e) => void saveSettings({ voiceURI: e.target.value })}
                className="w-auto min-w-[12rem]"
                disabled={!tts.supported()}
              >
                <option value="">{t('settings.voiceAuto')}</option>
                {tts.voices().map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label={t('settings.retention')}>
              <Select
                value={s.retention}
                onChange={(e) => void saveSettings({ retention: e.target.value as 'temp' | 'keep' })}
                className="w-auto min-w-[14rem]"
              >
                <option value="keep">{t('settings.retention.keep')}</option>
                <option value="temp">{t('settings.retention.temp')}</option>
              </Select>
            </Row>
            <div className="grid gap-2 border-t border-[var(--border)] pt-3 text-[0.78rem] text-[var(--text-3)]">
              <span>{t('settings.shortcutNew')}</span>
              <span>{t('settings.shortcutSearch')}</span>
              <span>{t('settings.shortcutTheme')}</span>
            </div>
          </Section>

          {/* -------------------------------- account ------------------------------ */}
          <Section title={t('settings.account')} icon="user">
            {!configured && (
              <div className="mb-3 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-3">
                <p className="text-[0.84rem] font-bold text-[var(--text)]">{t('auth.setupTitle')}</p>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-[var(--text-2)]">{t('auth.setupBody')}</p>
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1.5 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-[var(--accent-text)] hover:underline"
                >
                  Firebase Console <Icon name="external" className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[1.1rem] font-bold text-[var(--accent-text)]">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.92rem] font-bold text-[var(--text)]">{user?.name ?? '—'}</p>
                <p className="truncate text-[0.78rem] text-[var(--text-3)]">{user?.email ?? '—'}</p>
                <p className="text-[0.72rem] text-[var(--text-3)]">
                  {user?.emailVerified ? t('setup.ready') : t('auth.verifyEmail')}
                </p>
              </div>
              <Badge tone={workspace.localOnly ? 'warn' : 'ok'}>
                {workspace.localOnly ? t('common.notConfigured') : t('setup.ready')}
              </Badge>
            </div>

            <div className="space-y-3">
              <Field label={t('auth.name')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!user || !name.trim() || name === user?.name}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updateName(name.trim());
                    toast(t('settings.saved'), 'success');
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                  setBusy(false);
                }}
              >
                {t('common.saveChanges')}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon="key" onClick={() => setPwOpen(true)} disabled={!configured}>
                {t('settings.changePassword')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="logout"
                disabled={!user}
                onClick={async () => {
                  await signOut();
                  toast(t('auth.signedOut'));
                  navigate('/');
                }}
              >
                {t('common.signOut')}
              </Button>
              <Button variant="outline" size="sm" icon="sliders" onClick={() => navigate('/providers')} disabled={!health}>
                {t('settings.providers')}
              </Button>
              <Button variant="danger" size="sm" icon="trash" disabled={!user} onClick={() => setConfirmDelete(true)}>
                {t('settings.deleteAccount')}
              </Button>
            </div>
          </Section>

          {/* -------------------------------- privacy ------------------------------ */}
          <Section title={t('settings.privacy')} icon="shield">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon="download" onClick={() => void exportData()}>
                {t('settings.exportData')}
              </Button>
              <Button variant="outline" size="sm" icon="trash" onClick={() => setConfirmClear(true)}>
                {t('settings.clearHistory')}
              </Button>
            </div>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-[var(--text-3)]">
              {workspace.localOnly
                ? t('auth.setupBody')
                : t('library.sub')}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[0.78rem]">
              <Link to="/privacy" className="text-[var(--accent-text)] hover:underline">
                {t('legal.privacy')}
              </Link>
              <Link to="/terms" className="text-[var(--accent-text)] hover:underline">
                {t('legal.terms')}
              </Link>
              <Link to="/cookies" className="text-[var(--accent-text)] hover:underline">
                {t('legal.cookies')}
              </Link>
            </div>
          </Section>

          {/* ------------------------------- providers ----------------------------- */}
          <Section title={t('settings.providers')} icon="puzzle">
            <ProviderKeyRows />
          </Section>
        </div>
      </div>

      {/* change password */}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={t('settings.changePassword')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!curPw || newPw.length < 8}
              onClick={async () => {
                setBusy(true);
                try {
                  await changePassword(curPw, newPw);
                  toast(t('settings.saved'), 'success');
                  setPwOpen(false);
                  setCurPw('');
                  setNewPw('');
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
                setBusy(false);
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('auth.password')}>
            <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label={t('auth.confirmPassword')} hint={t('auth.weakPassword')}>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        danger
        title={t('settings.clearHistory')}
        body={t('chat.deleteChat')}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
          toast(t('settings.clearHistory'), 'success');
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t('settings.deleteAccount')}
        body={t('settings.deleteAccount')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteAccount();
            toast(t('settings.deleteAccount'), 'success');
            navigate('/');
          } catch (e) {
            toast((e as Error).message, 'error');
          }
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}

/* --------------------------------- pieces -------------------------------- */

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h2 className="text-[1rem] font-bold text-[var(--text)]">{title}</h2>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5 last:border-0 last:pb-0">
      <span className="text-[0.87rem] font-semibold text-[var(--text)]">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const models = useProviders((st) => st.models);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-[13rem]">
      <option value="">{t('common.none')}</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </Select>
  );
}

function ProviderKeyRows() {
  const { t } = useI18n();
  const rows = useProviderRows();
  const health = useProviders((st) => st.health);
  const navigate = useNavigate();
  const connected = PROVIDERS.filter((p) => rows.some((r) => r.provider === p.id && r.connected));

  if (!health)
    return <p className="text-[0.82rem] text-[var(--text-3)]">{t('providers.gatewayRequired')}</p>;

  if (connected.length === 0)
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.84rem] text-[var(--text-3)]">{t('providers.noKeysYet')}</p>
        <Button size="sm" variant="primary" onClick={() => navigate('/providers')}>
          {t('common.connect')}
        </Button>
      </div>
    );

  return (
    <ul className="grid gap-2">
      {connected.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3"
        >
          <VendorLogo name={p.name} slug={p.icon} color={p.color} size={28} rounded="rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.86rem] font-semibold text-[var(--text)]">{p.name}</span>
            <span className="block text-[0.72rem] text-[var(--text-3)]">
              {rows.find((r) => r.provider === p.id)?.keyHint ?? t('providers.keyHidden')}
            </span>
          </span>
          <Badge tone="ok">{t('common.connected')}</Badge>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/providers/${p.id}`)}>
            {t('common.manage')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
