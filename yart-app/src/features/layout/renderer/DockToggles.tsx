import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { DOCK_ICONS, DOCK_ORDER } from './dockIcons';
import { useDock } from './DockContext';

/** Knappar som fäller ut och ihop dockorna, för fönsterraden. */
export function DockToggles(): JSX.Element {
  const { layout, toggle } = useDock();
  return (
    <span className="dock-toggles">
      {DOCK_ORDER.map((side) => (
        <button
          key={side}
          type="button"
          className={`icon-button icon-button--quiet dock-toggles__button${layout[side].open ? ' is-open' : ''}`}
          title={t(`dock.toggle.${side}`)}
          aria-label={t(`dock.toggle.${side}`)}
          aria-pressed={layout[side].open}
          onClick={() => {
            toggle(side);
          }}
        >
          <Icon name={DOCK_ICONS[side]} size="md" />
        </button>
      ))}
    </span>
  );
}
