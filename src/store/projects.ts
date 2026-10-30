import { create } from 'zustand';
import { projects as projectWs, type ProjectDoc } from '../lib/workspace';
import { uid } from '../lib/utils';

interface ProjectState {
  projects: ProjectDoc[];
  activeId: string | null;
  watch: () => () => void;
  setActive: (id: string | null) => void;
  create: (input: { name: string; description?: string; instructions?: string }) => Promise<string>;
  update: (id: string, patch: Partial<ProjectDoc>) => void;
  remove: (id: string) => Promise<void>;
  linkFile: (id: string, fileId: string) => void;
  unlinkFile: (id: string, fileId: string) => void;
  toggleModel: (id: string, modelId: string) => void;
}

export const useProjects = create<ProjectState>()((set, get) => ({
  projects: [],
  activeId: null,
  watch: () =>
    projectWs.subscribe((rows) => {
      set({ projects: rows });
      const active = get().activeId;
      if (active && !rows.some((p) => p.id === active)) set({ activeId: null });
    }),
  setActive: (id) => set({ activeId: id }),
  create: async ({ name, description = '', instructions = '' }) => {
    const id = uid();
    const p: ProjectDoc = {
      id,
      name,
      description,
      instructions,
      fileIds: [],
      modelIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await projectWs.save(p);
    set({ activeId: id });
    return id;
  },
  update: (id, patch) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    void projectWs.save({ ...p, ...patch, updatedAt: Date.now() });
  },
  remove: async (id) => {
    await projectWs.remove(id);
    if (get().activeId === id) set({ activeId: null });
  },
  linkFile: (id, fileId) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p || p.fileIds.includes(fileId)) return;
    void projectWs.save({ ...p, fileIds: [...p.fileIds, fileId], updatedAt: Date.now() });
  },
  unlinkFile: (id, fileId) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    void projectWs.save({ ...p, fileIds: p.fileIds.filter((f) => f !== fileId), updatedAt: Date.now() });
  },
  toggleModel: (id, modelId) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    const has = p.modelIds.includes(modelId);
    void projectWs.save({
      ...p,
      modelIds: has ? p.modelIds.filter((m) => m !== modelId) : [...p.modelIds, modelId],
      updatedAt: Date.now(),
    });
  },
}));
