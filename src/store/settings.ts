import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Lang = 'ar' | 'en';
export type Scene = 'ridge' | 'cliff' | 'mist';

interface SettingsState {
  theme: Theme;
  lang: Lang;
  accent: string;
  fontSize: number; // 14 – 20 px
  density: 'comfy' | 'compact';
  motion: boolean;
  background: Scene;
  backgroundAnim: boolean;
  // chat
  defaultModel: string | null;
  enterToSend: boolean;
  markdown: boolean;
  webSearchDefault: boolean;
  retention: 'temp' | 'keep';
  voiceURI: string | '';
  // actions
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  setMany: (patch: Partial<SettingsState>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      lang: 'ar',
      accent: '#4C7DFF',
      fontSize: 16,
      density: 'comfy',
      motion: true,
      background: 'ridge',
      backgroundAnim: true,
      defaultModel: null,
      enterToSend: true,
      markdown: true,
      webSearchDefault: false,
      retention: 'keep',
      voiceURI: '',
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      setMany: (patch) => set(patch),
    }),
    { name: 'aiplatform.settings.v1' },
  ),
);

/** Applies the stored preferences to <html> / <body>. */
export function applySettings(s: SettingsState) {
  const root = document.documentElement;
  root.classList.toggle('dark', s.theme === 'dark');
  root.classList.toggle('reduce-motion', !s.motion);
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--accent-text', s.accent);
  root.style.fontSize = `${s.fontSize}px`;
  root.classList.toggle('density-compact', s.density === 'compact');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.theme === 'dark' ? '#0B0E13' : '#EEF1F5');
}
