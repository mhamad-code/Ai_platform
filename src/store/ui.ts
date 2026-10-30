import { create } from 'zustand';

export interface Toast {
  id: string;
  text: string;
  kind?: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toasts: Toast[];
  paletteOpen: boolean;
  settingsOpen: boolean;
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  dismiss: (id: string) => void;
  set: <K extends keyof UIState>(key: K, value: UIState[K]) => void;
}

let toastSeq = 0;

export const useUI = create<UIState>()((set, get) => ({
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem('aiplatform.sidebar.collapsed') === '1',
  toasts: [],
  paletteOpen: false,
  settingsOpen: false,
  toast: (text, kind = 'info', action) => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind, action }] }));
    setTimeout(() => get().dismiss(id), action ? 7000 : 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  set: (key, value) => set({ [key]: value } as Partial<UIState>),
}));
