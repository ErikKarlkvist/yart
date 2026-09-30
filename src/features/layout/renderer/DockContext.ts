import { createContext, useContext } from 'react';
import { type DockLayoutState, type DockSide } from '../model/dock';

export interface DockApi {
  layout: DockLayoutState;
  /** Flyttar panelen till dockan, på plats `index` eller sist */
  move: (id: string, side: DockSide, index?: number) => void;
  /** Öppnar panelens docka och visar panelen */
  reveal: (id: string) => void;
  activate: (id: string) => void;
  setOpen: (side: DockSide, open: boolean) => void;
  toggle: (side: DockSide) => void;
  resize: (side: DockSide, size: number) => void;
  /** Panelen som dras just nu, så alla dockor kan visa var den kan släppas */
  dragging: string | null;
  setDragging: (id: string | null) => void;
}

export const DockContext = createContext<DockApi | null>(null);

export function useDock(): DockApi {
  const api = useContext(DockContext);
  if (!api) throw new Error('useDock must be used inside DockProvider');
  return api;
}
