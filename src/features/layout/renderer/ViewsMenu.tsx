import { type JSX, useCallback, useRef, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useClickOutside } from '@/common/renderer/useClickOutside';
import { type DockSide } from '../model/dock';
import { DOCK_ICONS, DOCK_ORDER } from './dockIcons';
import { useDock } from './DockContext';
import { type DockPanel } from './panel';

interface Props {
  panels: readonly DockPanel[];
}

/**
 * Menyn Views i fönsterraden: alla paneler, grupperade efter docka, även de
 * stängda. Klick på en panel visar den och öppnar den om den var stängd.
 * Knapparna bredvid flyttar den till en annan docka eller stänger den.
 */
export function ViewsMenu({ panels }: Props): JSX.Element {
  const { layout, reveal, move, close } = useDock();
  const [isOpen, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);
  useClickOutside(root, isOpen, closeMenu);

  const byId = new Map(panels.map((panel) => [panel.id, panel]));

  return (
    <div className="views-menu" ref={root}>
      <button
        type="button"
        className="text-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('views.hint')}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <Icon name="views" size="sm" /> {t('views.button')}
      </button>
      {isOpen && (
        <div className="views-menu__popover" role="menu">
          {DOCK_ORDER.map((side) => {
            const dock = layout[side];
            const ids = [...dock.panels, ...dock.closed].filter((id) => byId.has(id));
            if (ids.length === 0) return null;
            return (
              <section key={side} className="views-menu__group">
                <div className="views-menu__heading">{t(`dock.${side}`)}</div>
                <ul className="views-menu__list">
                  {ids.map((id) => {
                    const panel = byId.get(id);
                    if (!panel) return null;
                    const closed = dock.closed.includes(id);
                    const visible = !closed && dock.open && dock.active === id;
                    const state = closed ? ' is-closed' : visible ? ' is-visible' : '';
                    const closeLabel = t('dock.close', { panel: panel.title });
                    return (
                      <li key={id} className={`views-menu__item${state}`}>
                        <button
                          type="button"
                          role="menuitem"
                          className="views-menu__open"
                          title={closed ? t('views.closed') : undefined}
                          onClick={() => {
                            reveal(id);
                            closeMenu();
                          }}
                        >
                          {panel.title}
                        </button>
                        <DockChoice
                          current={closed ? null : side}
                          onMove={(to) => {
                            move(id, to);
                          }}
                        />
                        <button
                          type="button"
                          className="icon-button icon-button--quiet views-menu__dock"
                          title={closeLabel}
                          aria-label={closeLabel}
                          disabled={closed}
                          onClick={() => {
                            close(id);
                          }}
                        >
                          <Icon name="close" size="sm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Tre små knappar, en per docka. Den panelen ligger i är markerad, ingen för en stängd panel. */
function DockChoice({
  current,
  onMove,
}: {
  current: DockSide | null;
  onMove: (to: DockSide) => void;
}): JSX.Element {
  return (
    <span className="views-menu__docks">
      {DOCK_ORDER.map((side) => {
        const label = t('dock.moveTo', { dock: t(`dock.${side}`) });
        return (
          <button
            key={side}
            type="button"
            className={`icon-button icon-button--quiet views-menu__dock${side === current ? ' is-current' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={side === current}
            disabled={side === current}
            onClick={() => {
              onMove(side);
            }}
          >
            <Icon name={DOCK_ICONS[side]} size="sm" />
          </button>
        );
      })}
    </span>
  );
}
