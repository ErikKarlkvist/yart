import { type JSX, useCallback } from 'react';
import { t } from '@/common/model/i18n';
import { Splitter } from '@/common/renderer/Splitter';
import { DOCK_LIMITS, type DockSide } from '../model/dock';
import { useDock } from './DockContext';

/**
 * Draghandtaget som ändrar en dockas storlek. Sitter på dockans inre kant,
 * och kan även läggas på andra ställen som ska styra samma mått.
 */
export function DockResizeHandle({ side }: { side: DockSide }): JSX.Element {
  const { layout, resize } = useDock();
  const onResize = useCallback(
    (size: number) => {
      resize(side, size);
    },
    [resize, side],
  );
  return (
    <Splitter
      orientation={side === 'bottom' ? 'horizontal' : 'vertical'}
      size={layout[side].size}
      min={DOCK_LIMITS[side].min}
      max={DOCK_LIMITS[side].max}
      inverted={side !== 'left'}
      edge={side === 'right' ? 'start' : 'end'}
      onResize={onResize}
      label={t('dock.resize', { dock: t(`dock.${side}`) })}
    />
  );
}
