import { type DragEvent as ReactDragEvent, type JSX, type ReactNode, useState } from 'react';
import { t } from '@/common/model/i18n';
import { type DockSide } from '../model/dock';
import { DockArea } from './DockArea';
import { useDock } from './DockContext';
import { type DockPanel } from './panel';
import './dock.css';

interface Props {
  /** Alla paneler appen har. Var de ligger bestäms av layouten. */
  panels: readonly DockPanel[];
  /** Huvudytan i mitten, som inte går att flytta */
  children: ReactNode;
}

/**
 * Huvudytan med dockorna runt: vänster och höger i full höjd, den nedre
 * under huvudytan. Medan en flik dras visas släppytor för hopfällda dockor.
 */
export function DockLayout({ panels, children }: Props): JSX.Element {
  const { layout } = useDock();
  const byId = new Map(panels.map((panel) => [panel.id, panel]));

  return (
    <div
      className="dock-layout"
      style={{
        '--dock-left': `${layout.left.size}px`,
        '--dock-right': `${layout.right.size}px`,
        '--dock-bottom': `${layout.bottom.size}px`,
      }}
    >
      {layout.left.open && <DockArea side="left" panels={byId} />}
      <div className="dock-layout__center">
        <div className="dock-layout__main">{children}</div>
        {layout.bottom.open && <DockArea side="bottom" panels={byId} />}
        <DockEdge side="bottom" />
      </div>
      {layout.right.open && <DockArea side="right" panels={byId} />}
      <DockEdge side="left" />
      <DockEdge side="right" />
    </div>
  );
}

/** Släppyta längs kanten för en hopfälld docka. Syns bara medan en flik dras. */
function DockEdge({ side }: { side: DockSide }): JSX.Element | null {
  const { layout, move, dragging, setDragging } = useDock();
  // Taggas med panelen som dras, så en avbruten dragning inte lämnar ytan markerad.
  const [overFor, setOverFor] = useState<string | null>(null);
  if (dragging === null || layout[side].open) return null;
  const over = overFor === dragging;

  const onDragOver = (event: ReactDragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!over) setOverFor(dragging);
  };
  const onDrop = (event: ReactDragEvent<HTMLElement>): void => {
    event.preventDefault();
    move(dragging, side);
    setDragging(null);
    setOverFor(null);
  };

  return (
    <div
      className={`dock-edge dock-edge--${side}${over ? ' is-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={() => {
        setOverFor(null);
      }}
      onDrop={onDrop}
    >
      <span className="dock-edge__label">{t('dock.drop', { dock: t(`dock.${side}`) })}</span>
    </div>
  );
}
