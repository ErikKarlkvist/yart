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
 * Menyn Views i fönsterraden: alla paneler, grupperade efter docka. Klick på
 * en panel visar den, knapparna bredvid flyttar den till en annan docka.
 */
export function ViewsMenu({ panels }: Props): JSX.Element {
  const { layout, reveal, move } = useDock();
  const [isOpen, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useClickOutside(root, isOpen, close);

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
            const ids = dock.panels.filter((id) => byId.has(id));
            if (ids.length === 0) return null;
            return (
              <section key={side} className="views-menu__group">
                <div className="views-menu__heading">{t(`dock.${side}`)}</div>
                <ul className="views-menu__list">
                  {ids.map((id) => {
                    const panel = byId.get(id);
                    if (!panel) return null;
                    const visible = dock.open && dock.active === id;
                    return (
                      <li key={id} className={`views-menu__item${visible ? ' is-visible' : ''}`}>
                        <button
                          type="button"
                          role="menuitem"
                          className="views-menu__open"
                          onClick={() => {
                            reveal(id);
                            close();
                          }}
                        >
                          {panel.title}
                        </button>
                        <DockChoice
                          current={side}
                          onMove={(to) => {
                            move(id, to);
                          }}
                        />
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

/** Tre små knappar, en per docka. Den panelen ligger i är markerad. */
function DockChoice({
  current,
  onMove,
}: {
  current: DockSide;
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
