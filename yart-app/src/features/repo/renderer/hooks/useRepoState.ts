import { useCallback, useEffect, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { readStored, useScopedKey, writeStored } from '@/common/renderer/storage';
import {
  currentBranchChannel,
  fetchRepoChannel,
  forgetRepoChannel,
  listRecentReposChannel,
  openDemoRepoChannel,
  openRepoChannel,
  pickLocalRepoChannel,
} from '../../ipc/channels';
import { type RepoInfo } from '../../model/repo';
import { errorMessage } from '@/common/model/json';

const BRANCH_CHECK_INTERVAL_MS = 30_000;

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
  const lastRepoKey = useScopedKey('yart.lastRepo');
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
        else setError(errorMessage(e));
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

  // Git kan byta branch i terminalen medan appen är öppen. Läs bara HEAD tills
  // något ändras; då läses hela repot och listan över senaste om.
  useEffect(() => {
    if (!repoPath || !repo?.isGit) return;
    const controller = new AbortController();
    const isActive = (): boolean => !controller.signal.aborted;
    const isForeground = (): boolean =>
      document.visibilityState === 'visible' && document.hasFocus();
    let checking = false;
    const refreshBranch = async (): Promise<void> => {
      if (!isActive() || checking || !isForeground()) return;
      checking = true;
      try {
        const branch = await invokeChannel(currentBranchChannel, { repoPath });
        if (!isActive() || branch === repo.branch) return;
        const refreshed = await invokeChannel(openRepoChannel, { path: repoPath });
        const list = await invokeChannel(listRecentReposChannel, undefined);
        if (!isActive()) return;
        setRecent(list);
        setRepo((current) => (current?.path === repoPath ? refreshed : current));
      } catch {
        // Ett pågående checkout-byte kan tillfälligt göra HEAD oläsbart.
      } finally {
        checking = false;
      }
    };
    const checkBranch = (): void => {
      void refreshBranch();
    };
    let foreground = isForeground();
    let timer: number | undefined;
    const startPolling = (): void => {
      timer = window.setInterval(checkBranch, BRANCH_CHECK_INTERVAL_MS);
    };
    const syncFocus = (): void => {
      const focused = isForeground();
      if (focused === foreground) return;
      foreground = focused;
      if (timer !== undefined) window.clearInterval(timer);
      if (focused) {
        checkBranch();
        startPolling();
      }
    };
    if (foreground) startPolling();
    window.addEventListener('focus', syncFocus);
    window.addEventListener('blur', syncFocus);
    document.addEventListener('visibilitychange', syncFocus);
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener('focus', syncFocus);
      window.removeEventListener('blur', syncFocus);
      document.removeEventListener('visibilitychange', syncFocus);
    };
  }, [repoPath, repo?.branch, repo?.isGit]);

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
