import { type JSX, type ReactNode, useCallback, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import {
  activatePanel,
  closePanel,
  type DockLayoutState,
  type DockSide,
  movePanel,
  normalizeLayout,
  resizeDock,
  revealPanel,
  setDockOpen,
} from '../model/dock';
import { type DockApi, DockContext } from './DockContext';

interface Props {
  /** Standardlayouten. Den bestämmer också vilka paneler som finns. */
  defaults: DockLayoutState;
  storageKey: string;
  children: ReactNode;
}

/**
 * Äger dockornas layout för hela appen. Layouten delas av alla appflikar och
 * sparas, så paneler man flyttat ligger kvar efter en omstart.
 */
export function DockProvider({ defaults, storageKey, children }: Props): JSX.Element {
  const [layout, setLayout] = useState<DockLayoutState>(() =>
    normalizeLayout(parse(readStored(storageKey)), defaults),
  );
  const [dragging, setDragging] = useState<string | null>(null);

  const update = useCallback(
    (change: (current: DockLayoutState) => DockLayoutState) => {
      setLayout((current) => {
        const next = change(current);
        if (next !== current) writeStored(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  // Åtgärderna är stabila, så den som bara vill flytta eller visa paneler inte ritas om vid varje ändring.
  const actions = useMemo(
    () => ({
      move: (id: string, side: DockSide, index?: number) => {
        update((l) => movePanel(l, id, side, index));
      },
      reveal: (id: string) => {
        update((l) => revealPanel(l, id));
      },
      close: (id: string) => {
        update((l) => closePanel(l, id));
      },
      activate: (id: string) => {
        update((l) => activatePanel(l, id));
      },
      setOpen: (side: DockSide, open: boolean) => {
        update((l) => setDockOpen(l, side, open));
      },
      toggle: (side: DockSide) => {
        update((l) => setDockOpen(l, side, !l[side].open));
      },
      resize: (side: DockSide, size: number) => {
        update((l) => resizeDock(l, side, size));
      },
    }),
    [update],
  );
  const api = useMemo<DockApi>(
    () => ({ ...actions, layout, dragging, setDragging }),
    [actions, layout, dragging],
  );

  return <DockContext.Provider value={api}>{children}</DockContext.Provider>;
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
