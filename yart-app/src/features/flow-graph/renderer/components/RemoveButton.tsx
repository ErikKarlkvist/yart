import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';

/** Krysset uppe i hörnet på en nod. `nodrag` hindrar React Flow från att börja dra. */
export function RemoveButton({ onRemove }: { onRemove: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="graph-node__remove nodrag"
      title={t('graph.remove')}
      aria-label={t('graph.remove')}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
    >
      <Icon name="close" size="sm" />
    </button>
  );
}
