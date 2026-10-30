import { useEffect, useState } from 'react';
import {
  files,
  folders,
  integrations,
  modelParams,
  providerKeys,
  projects,
} from './workspace';

type FileDoc = import('./db').FileDoc;
type FolderDoc = import('./db').FolderDoc;
type ProjectDoc = import('./db').ProjectDoc;
type IntegrationDoc = import('./db').IntegrationDoc;
type ModelParams = import('./db').ModelParams;
type ProviderConnection = import('../ai/types').ProviderConnection;

/* Module-level wrappers stay referentially stable, so the effect below only
   re-subscribes when the repository itself changes (never on re-render). */
const subFiles = (cb: (rows: FileDoc[]) => void) => files.subscribe(cb);
const subFolders = (cb: (rows: FolderDoc[]) => void) => folders.subscribe(cb);
const subProjects = (cb: (rows: ProjectDoc[]) => void) => projects.subscribe(cb);
const subIntegrations = (cb: (rows: IntegrationDoc[]) => void) => integrations.subscribe(cb);
const subProviders = (cb: (rows: ProviderConnection[]) => void) => providerKeys.subscribe(cb);
const subModelParams = (cb: (rows: ModelParams[]) => void) => modelParams.subscribe(cb);

/**
 * Subscribes to one of the workspace repositories (Firestore when a user is
 * signed in, this browser otherwise) and returns the current rows.
 */
export function useWorkspaceList<T>(
  subscribe: (cb: (rows: T[]) => void) => () => void,
  initial: T[] = [],
): T[] {
  const [rows, setRows] = useState<T[]>(initial);
  useEffect(() => subscribe(setRows), [subscribe]);
  return rows;
}

export const subs = {
  files: subFiles,
  folders: subFolders,
  projects: subProjects,
  integrations: subIntegrations,
  providers: subProviders,
  modelParams: subModelParams,
};

export const useFiles = () => useWorkspaceList<FileDoc>(subFiles);
export const useFolders = () => useWorkspaceList<FolderDoc>(subFolders);
export const useProjectsList = () => useWorkspaceList<ProjectDoc>(subProjects);
export const useIntegrationRows = () => useWorkspaceList<IntegrationDoc>(subIntegrations);
export const useProviderRows = () => useWorkspaceList<ProviderConnection>(subProviders);
export const useModelParams = () => useWorkspaceList<ModelParams>(subModelParams);
