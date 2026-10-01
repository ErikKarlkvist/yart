import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';

/** Pratbubblan på noder och anrop. `nodrag` och `nopan` håller React Flow borta från klicket. */
export function AskButton({ onAsk }: { onAsk: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="graph-node__ask nodrag nopan"
      title={t('ask.button')}
      aria-label={t('ask.button')}
      onClick={(event) => {
        event.stopPropagation();
        onAsk();
      }}
    >
      <Icon name="chat" size="sm" />
    </button>
  );
}
