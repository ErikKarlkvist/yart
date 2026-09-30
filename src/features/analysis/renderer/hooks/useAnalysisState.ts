import { useCallback, useEffect, useMemo, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { readStoredJson, useScopedKey, writeStored } from '@/common/renderer/storage';
import { useIpcEvent } from '@/common/renderer/useIpcEvent';
import {
  deleteAnalysisChannel,
  type DeliveredVia,
  type DeliveryEvent,
  deliveryEvent,
  listAnalysesChannel,
} from '../../ipc/channels';
import { t } from '@/common/model/i18n';
import { analysisTitle, type SavedAnalysis } from '../../model/analysis';
import { errorMessage } from '@/common/model/json';

/** En rad i leveransloggen: en sparad analys eller ett avvisat försök. */
type DeliveryEntry = { at: string; source: string } & (
  { type: 'imported'; title: string; id: string } | { type: 'rejected'; errors: string[] }
);

/** Vem som levererade, som det visas i loggen. */
function describeVia(via: DeliveredVia): string {
  return t('log.via', { client: via.client, tool: via.tool });
}

export interface AnalysisState {
  analyses: SavedAnalysis[];
  current: SavedAnalysis | null;
  error: string | null;
  /** Nyast först */
  deliveries: DeliveryEntry[];
  /** Senaste avvisade leveransen, tills något sparas eller användaren stänger den */
  rejection: DeliveryEntry | null;
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
  const [log, setLog] = useState<Tagged<DeliveryEntry[]> | null>(null);
  const [rejectionState, setRejection] = useState<Tagged<DeliveryEntry> | null>(null);

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
      if (!cancelled) setLoadError({ repoPath, value: errorMessage(e) });
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

  const onDelivery = useCallback(
    (event: DeliveryEvent) => {
      if (event.repoPath !== repoPath) return;
      const at = new Date().toISOString();
      const source = describeVia(event.via);
      const entry: DeliveryEntry =
        event.type === 'imported'
          ? {
              at,
              source,
              type: 'imported',
              title: analysisTitle(event.analysis),
              id: event.analysis.id,
            }
          : { at, source, type: 'rejected', errors: event.errors };
      setLog((current) => ({
        repoPath,
        value: [entry, ...(current?.repoPath === repoPath ? current.value : [])],
      }));
      if (event.type === 'imported') {
        setLoaded({ repoPath, list: event.list });
        select(event.analysis.id);
        setRejection(null);
      } else {
        setRejection({ repoPath, value: entry });
      }
    },
    [repoPath, select],
  );
  useIpcEvent(deliveryEvent, onDelivery);

  const analyses = useMemo(
    () => (loaded?.repoPath === repoPath ? loaded.list : []),
    [loaded, repoPath],
  );
  const error = loadError?.repoPath === repoPath ? loadError.value : null;
  const currentId = selection?.repoPath === repoPath ? selection.value : null;
  const deliveries = log?.repoPath === repoPath ? log.value : [];
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
  return { analyses, current, error, deliveries, rejection, select, remove, dismissRejection };
}
