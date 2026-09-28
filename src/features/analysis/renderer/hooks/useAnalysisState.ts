import { useCallback, useEffect, useMemo, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { readStoredJson, useScopedKey, writeStored } from '@/common/renderer/storage';
import { useIpcEvent } from '@/common/renderer/useIpcEvent';
import {
  deleteAnalysisChannel,
  type InboxEvent,
  inboxEvent,
  listAnalysesChannel,
  watchInboxChannel,
} from '../../ipc/channels';
import { analysisTitle, type SavedAnalysis } from '../../model/analysis';

/** En rad i inkorgens logg: en import eller ett avvisat försök. */
type InboxEntry = { at: string } & (
  | { type: 'imported'; file: string; title: string; id: string }
  | { type: 'rejected'; file: string; errors: string[] }
);

export interface AnalysisState {
  analyses: SavedAnalysis[];
  current: SavedAnalysis | null;
  error: string | null;
  /** Nyast först */
  inbox: InboxEntry[];
  /** Senaste avvisade filen, tills något importeras eller användaren stänger den */
  rejection: InboxEntry | null;
  select: (id: string | null) => void;
  remove: (id: string) => Promise<void>;
  dismissRejection: () => void;
}

interface Loaded {
  repoPath: string;
  list: SavedAnalysis[];
}

interface Tagged<T> {
  repoPath: string;
  value: T;
}

function isSelection(value: unknown): value is Tagged<string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Tagged<unknown>).repoPath === 'string' &&
    typeof (value as Tagged<unknown>).value === 'string'
  );
}

/**
 * Listan följer repot. Allt state taggas med repots sökväg och härleds mot det
 * aktuella repot, så byte av repo ger tom lista och inget val utan att något
 * behöver nollställas i en effekt. Valet sparas per appflik och återtas vid start.
 */
export function useAnalysisState(repoPath: string | null): AnalysisState {
  const lastAnalysisKey = useScopedKey('reverik.lastAnalysis');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selection, setSelection] = useState<Tagged<string> | null>(null);
  const [loadError, setLoadError] = useState<Tagged<string> | null>(null);
  const [inboxLog, setInboxLog] = useState<Tagged<InboxEntry[]> | null>(null);
  const [rejectionState, setRejection] = useState<Tagged<InboxEntry> | null>(null);

  const rememberSelection = useCallback(
    (next: Tagged<string> | null) => {
      writeStored(lastAnalysisKey, next ? JSON.stringify(next) : null);
    },
    [lastAnalysisKey],
  );

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    const fail = (e: unknown): void => {
      if (!cancelled) setLoadError({ repoPath, value: e instanceof Error ? e.message : String(e) });
    };
    invokeChannel(listAnalysesChannel, { repoPath })
      .then((list) => {
        if (cancelled) return;
        setLoaded({ repoPath, list });
        // Återta analysen som var vald senast, om den fortfarande finns.
        const last = readStoredJson(lastAnalysisKey, isSelection);
        if (last?.repoPath === repoPath && list.some((a) => a.id === last.value))
          setSelection(last);
      })
      .catch(fail);
    invokeChannel(watchInboxChannel, { repoPath }).catch(fail);
    return () => {
      cancelled = true;
    };
  }, [repoPath, lastAnalysisKey]);

  const select = useCallback(
    (id: string | null) => {
      const next = id && repoPath ? { repoPath, value: id } : null;
      setSelection(next);
      rememberSelection(next);
    },
    [repoPath, rememberSelection],
  );

  const onInbox = useCallback(
    (event: InboxEvent) => {
      if (event.repoPath !== repoPath) return;
      const at = new Date().toISOString();
      const entry: InboxEntry =
        event.type === 'imported'
          ? {
              at,
              type: 'imported',
              file: event.file,
              title: analysisTitle(event.analysis),
              id: event.analysis.id,
            }
          : { at, type: 'rejected', file: event.file, errors: event.errors };
      setInboxLog((log) => ({
        repoPath,
        value: [entry, ...(log?.repoPath === repoPath ? log.value : [])],
      }));
      if (event.type === 'imported') {
        setLoaded({ repoPath, list: event.list });
        // Bara en fil som just sparats tar över valet, inte skanningen vid start
        if (!event.initial) select(event.analysis.id);
        setRejection(null);
      } else {
        setRejection({ repoPath, value: entry });
      }
    },
    [repoPath, select],
  );
  useIpcEvent(inboxEvent, onInbox);

  const analyses = useMemo(
    () => (loaded?.repoPath === repoPath ? loaded.list : []),
    [loaded, repoPath],
  );
  const error = loadError?.repoPath === repoPath ? loadError.value : null;
  const currentId = selection?.repoPath === repoPath ? selection.value : null;
  const inbox = inboxLog?.repoPath === repoPath ? inboxLog.value : [];
  const rejection = rejectionState?.repoPath === repoPath ? rejectionState.value : null;

  const remove = useCallback(
    async (id: string) => {
      if (!repoPath) return;
      const list = await invokeChannel(deleteAnalysisChannel, { repoPath, id });
      setLoaded({ repoPath, list });
      setSelection((current) => (current?.value === id ? null : current));
    },
    [repoPath],
  );

  const dismissRejection = useCallback(() => {
    setRejection(null);
  }, []);

  const current = analyses.find((a) => a.id === currentId) ?? null;
  return { analyses, current, error, inbox, rejection, select, remove, dismissRejection };
}
