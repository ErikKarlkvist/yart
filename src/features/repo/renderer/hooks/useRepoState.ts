import { useCallback, useEffect, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { readStored, useScopedKey, writeStored } from '@/common/renderer/storage';
import {
  fetchRepoChannel,
  forgetRepoChannel,
  listRecentReposChannel,
  openDemoRepoChannel,
  openRepoChannel,
  pickLocalRepoChannel,
} from '../../ipc/channels';
import { type RepoInfo } from '../../model/repo';

export interface RepoState {
  repo: RepoInfo | null;
  recent: RepoInfo[];
  busy: boolean;
  error: string | null;
  pickLocal: () => Promise<void>;
  openDemo: () => Promise<void>;
  open: (path: string) => Promise<void>;
  forget: (path: string) => Promise<void>;
  clearError: () => void;
  /** git fetch och omläsning av repot */
  fetch: () => Promise<void>;
}

export function useRepoState(): RepoState {
  // Valt repo är per appflik
  const lastRepoKey = useScopedKey('reverik.lastRepo');
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [recent, setRecent] = useState<RepoInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (task: () => Promise<RepoInfo | null>, quiet = false) => {
      setBusy(true);
      setError(null);
      try {
        const result = await task();
        if (result) {
          setRepo(result);
          writeStored(lastRepoKey, result.path);
          setRecent(await invokeChannel(listRecentReposChannel, undefined));
        }
      } catch (e) {
        if (quiet) writeStored(lastRepoKey, null);
        else setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [lastRepoKey],
  );

  // Vid start: hämta listan och öppna repot som var valt senast, tyst om det försvunnit.
  useEffect(() => {
    void invokeChannel(listRecentReposChannel, undefined).then((list) => {
      setRecent(list);
      const last = readStored(lastRepoKey);
      if (last) void run(() => invokeChannel(openRepoChannel, { path: last }), true);
    });
  }, [run, lastRepoKey]);

  const pickLocal = useCallback(
    () => run(() => invokeChannel(pickLocalRepoChannel, undefined)),
    [run],
  );
  const openDemo = useCallback(
    () => run(() => invokeChannel(openDemoRepoChannel, undefined)),
    [run],
  );
  const open = useCallback(
    (path: string) => run(() => invokeChannel(openRepoChannel, { path })),
    [run],
  );
  const repoPath = repo?.path ?? null;

  const fetch = useCallback(() => {
    if (!repoPath) return Promise.resolve();
    return run(() => invokeChannel(fetchRepoChannel, { repoPath }));
  }, [repoPath, run]);

  const forget = useCallback(
    async (path: string) => {
      setRecent(await invokeChannel(forgetRepoChannel, { path }));
      setRepo((current) => (current?.path === path ? null : current));
      if (readStored(lastRepoKey) === path) writeStored(lastRepoKey, null);
    },
    [lastRepoKey],
  );
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    repo,
    recent,
    busy,
    error,
    pickLocal,
    openDemo,
    open,
    forget,
    clearError,
    fetch,
  };
}
