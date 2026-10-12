import { type JSX, useRef } from 'react';
import { useClickOutside } from './useClickOutside';
import './context-menu.css';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  /** Vid klick utanför, Escape eller efter ett val */
  onDismiss: () => void;
}

/** En högerklicksmeny på en fast punkt i fönstret: en knapp per val. */
export function ContextMenu({ x, y, items, onDismiss }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, true, onDismiss);
  return (
    <div ref={ref} className="context-menu" role="menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="context-menu__item"
          disabled={item.disabled}
          onClick={() => {
            onDismiss();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
