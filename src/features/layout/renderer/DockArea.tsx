import { type DragEvent as ReactDragEvent, type JSX, useCallback, useRef, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon, type IconName } from '@/common/renderer/Icon';
import { useClickOutside } from '@/common/renderer/useClickOutside';
import { DOCK_SIDES, type DockSide } from '../model/dock';
import { useDock } from './DockContext';
import { DockResizeHandle } from './DockResizeHandle';
import { type DockPanel } from './panel';

/** Typen på det som dras, så andra drag (filer, text) inte tas emot */
const PANEL_DRAG_TYPE = 'application/x-reverik-panel';

const HIDE_ICON: Readonly<Record<DockSide, IconName>> = {
  left: 'chevronLeft',
  right: 'chevronRight',
  bottom: 'chevronDown',
};

interface Props {
  side: DockSide;
  panels: ReadonlyMap<string, DockPanel>;
}

/**
 * En docka: flikrad med dragbara flikar och panelerna under. Alla paneler i
 * dockan hålls monterade så inmatning och scroll behålls när man byter flik.
 */
export function DockArea({ side, panels }: Props): JSX.Element {
  const { layout, move, activate, close, setOpen, dragging, setDragging } = useDock();
  const dock = layout[side];
  const ids = dock.panels.filter((id) => panels.has(id));
  const isAvailable = (id: string): boolean => panels.get(id)?.available !== false;
  const shown =
    dock.active !== null && ids.includes(dock.active) && isAvailable(dock.active)
      ? dock.active
      : (ids.find(isAvailable) ?? null);

  const stripRef = useRef<HTMLDivElement>(null);
  // Var ett släpp skulle hamna: före fliken på `index`, eller sist när index saknas.
  // Taggas med panelen som dras, så en avbruten dragning inte lämnar kvar markeringen.
  const [over, setOver] = useState<{ id: string; index?: number } | null>(null);
  const drop = over !== null && over.id === dragging ? over : null;
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  /** Flikindex under pekaren i flikraden, räknat mot flikarnas mittpunkter */
  const indexAt = (x: number): number => {
    const tabs = stripRef.current?.querySelectorAll<HTMLElement>('[data-dock-tab]') ?? [];
    let index = 0;
    for (const tab of tabs) {
      const rect = tab.getBoundingClientRect();
      if (x < rect.left + rect.width / 2) return index;
      index += 1;
    }
    return index;
  };

  const onDragOver = (event: ReactDragEvent<HTMLElement>): void => {
    if (dragging === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const inStrip = stripRef.current?.contains(event.target as Node) ?? false;
    const index = inStrip ? indexAt(event.clientX) : undefined;
    if (drop === null || drop.index !== index)
      setOver(index === undefined ? { id: dragging } : { id: dragging, index });
  };

  const onDragLeave = (event: ReactDragEvent<HTMLElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
  };

  const onDrop = (event: ReactDragEvent<HTMLElement>): void => {
    if (dragging === null) return;
    event.preventDefault();
    // Index i flikraden översätts till index i dockans lista, som kan ha paneler utan definition.
    const before = drop?.index === undefined ? undefined : ids[drop.index];
    const index =
      drop?.index === undefined
        ? undefined
        : before === undefined
          ? dock.panels.length
          : dock.panels.indexOf(before);
    move(dragging, side, index);
    setDragging(null);
    setOver(null);
  };

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const dockName = t(`dock.${side}`);

  return (
    <section
      className={`dock dock--${side}${drop && drop.index === undefined ? ' is-drop-target' : ''}`}
      aria-label={dockName}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <DockResizeHandle side={side} />
      <div className="tab-strip dock__tabs">
        <div ref={stripRef} className="dock__tab-list" role="tablist">
          {ids.map((id, index) => {
            const panel = panels.get(id);
            if (!panel) return null;
            const available = isAvailable(id);
            const classes = [
              'tab',
              'tab--caps',
              'dock__tab',
              id === shown ? 'is-active' : '',
              available ? '' : 'is-unavailable',
              dragging === id ? 'is-dragging' : '',
              drop?.index === index ? 'is-drop-before' : '',
              drop?.index === ids.length && index === ids.length - 1 ? 'is-drop-after' : '',
            ];
            const closeLabel = t('dock.close', { panel: panel.title });
            return (
              <div
                key={id}
                data-dock-tab
                draggable
                className={classes.filter(Boolean).join(' ')}
                title={t('dock.tabHint')}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(PANEL_DRAG_TYPE, id);
                  setDragging(id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ id, x: event.clientX, y: event.clientY });
                }}
                onAuxClick={(event) => {
                  // Mittenklick stänger, som flikar i en webbläsare
                  if (event.button === 1) close(id);
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={id === shown}
                  aria-disabled={!available}
                  className="tab__open"
                  onClick={() => {
                    if (available) activate(id);
                  }}
                >
                  {panel.title}
                </button>
                <button
                  type="button"
                  className="tab__close"
                  title={closeLabel}
                  aria-label={closeLabel}
                  onClick={() => {
                    close(id);
                  }}
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
            );
          })}
        </div>
        <span className="dock__spacer" />
        <button
          type="button"
          className="icon-button icon-button--quiet"
          title={t('dock.hide', { dock: dockName })}
          aria-label={t('dock.hide', { dock: dockName })}
          onClick={() => {
            setOpen(side, false);
          }}
        >
          <Icon name={HIDE_ICON[side]} size="sm" />
        </button>
      </div>
      <div className="dock__body">
        {ids.map((id) => {
          const panel = panels.get(id);
          if (!panel) return null;
          return (
            <div
              key={id}
              role="tabpanel"
              aria-label={panel.title}
              className={`dock__pane${panel.fill ? ' dock__pane--fill' : ''}${id === shown ? ' is-active' : ''}`}
            >
              {panel.content}
            </div>
          );
        })}
        {ids.length === 0 && <p className="dock__empty">{t('dock.empty')}</p>}
      </div>
      {menu && (
        <DockTabMenu
          x={menu.x}
          y={menu.y}
          from={side}
          onMove={(to) => {
            move(menu.id, to);
            closeMenu();
          }}
          onCloseTab={() => {
            close(menu.id);
            closeMenu();
          }}
          onDismiss={closeMenu}
        />
      )}
    </section>
  );
}

interface MenuProps {
  x: number;
  y: number;
  from: DockSide;
  onMove: (to: DockSide) => void;
  onCloseTab: () => void;
  onDismiss: () => void;
}

/** Högerklicksmenyn på en flik: flytta den till en annan docka utan att dra, eller stäng den. */
function DockTabMenu({ x, y, from, onMove, onCloseTab, onDismiss }: MenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, true, onDismiss);
  return (
    <div ref={ref} className="dock-menu" role="menu" style={{ left: x, top: y }}>
      {DOCK_SIDES.filter((side) => side !== from).map((side) => (
        <button
          key={side}
          type="button"
          role="menuitem"
          className="dock-menu__item"
          onClick={() => {
            onMove(side);
          }}
        >
          {t('dock.moveTo', { dock: t(`dock.${side}`) })}
        </button>
      ))}
      <button type="button" role="menuitem" className="dock-menu__item" onClick={onCloseTab}>
        {t('dock.closeTab')}
      </button>
    </div>
  );
}
