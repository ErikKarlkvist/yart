import { type IconName } from '@/common/renderer/Icon';
import { type DockSide } from '../model/dock';

/** Dockorna i den ordning de ligger från vänster, för knappar och menyer */
export const DOCK_ORDER: readonly DockSide[] = ['left', 'bottom', 'right'];

export const DOCK_ICONS: Readonly<Record<DockSide, IconName>> = {
  left: 'dockLeft',
  bottom: 'dockBottom',
  right: 'dockRight',
};
