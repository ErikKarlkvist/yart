import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { Icon, type IconName } from '@/common/renderer/Icon';
import { type DockSide } from '../model/dock';
import { useDock } from './DockContext';

/** Samma ordning som dockorna ligger i från vänster */
const ORDER: readonly DockSide[] = ['left', 'bottom', 'right'];

const ICONS: Readonly<Record<DockSide, IconName>> = {
  left: 'dockLeft',
  bottom: 'dockBottom',
  right: 'dockRight',
};

/** Knappar som fäller ut och ihop dockorna, för fönsterraden. */
export function DockToggles(): JSX.Element {
  const { layout, toggle } = useDock();
  return (
    <span className="dock-toggles">
      {ORDER.map((side) => (
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
          <Icon name={ICONS[side]} size="md" />
        </button>
      ))}
    </span>
  );
}
