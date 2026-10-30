import { create } from 'zustand';
import type { PendingAttachment } from './chat';

/**
 * Lets the Library hand a stored file to the chat composer: the page that owns
 * the file pushes it here, the composer drains the queue on mount.
 */
interface PendingState {
  items: PendingAttachment[];
  add: (a: PendingAttachment) => void;
  drain: () => PendingAttachment[];
}

export const usePendingAttachments = create<PendingState>()((set, get) => ({
  items: [],
  add: (a) => set((s) => ({ items: [...s.items, a] })),
  drain: () => {
    const items = get().items;
    if (items.length) set({ items: [] });
    return items;
  },
}));
