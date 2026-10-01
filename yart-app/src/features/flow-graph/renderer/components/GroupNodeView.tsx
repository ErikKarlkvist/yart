import { type Node, type NodeProps } from '@xyflow/react';
import { type JSX, memo } from 'react';
import { type SystemKind } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useZoomOut } from './GraphStateContext';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type GroupNodeData = {
  kind: SystemKind;
  label: string;
};

export type GroupNode = Node<GroupNodeData, 'systemGroup'>;

/** Ram runt ett systems noder i detaljvyn. */
export const GroupNodeView = memo(function GroupNodeView({
  data,
}: NodeProps<GroupNode>): JSX.Element {
  const zoomOut = useZoomOut();
  return (
    <div className={`graph-group graph-group--${data.kind}`}>
      <span className="graph-group__label">
        <Icon name={data.kind} size="sm" /> {data.label}
        <button
          type="button"
          className="graph-group__zoom-out nodrag nopan"
          title={t('graph.zoomOut')}
          aria-label={t('graph.zoomOut')}
          onClick={(event) => {
            event.stopPropagation();
            zoomOut();
          }}
        >
          <Icon name="zoomOut" size="sm" />
        </button>
      </span>
    </div>
  );
});
