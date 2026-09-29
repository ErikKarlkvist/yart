import { Handle, NodeResizer, type Node, type NodeProps, Position } from '@xyflow/react';
import { type JSX, memo, useCallback } from 'react';
import { t } from '@/common/model/i18n';
import { type FlowChange, type ReviewFinding } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { type GraphKind, type GraphLevel, type TableInfo } from '../../model/graph';
import { type Size } from '../../model/layout';
import { useNodeState } from './GraphStateContext';
import { AskButton } from './AskButton';
import { FindingFlag } from './FindingFlag';
import { RemoveButton } from './RemoveButton';

// React Flow kräver Record<string, unknown>, vilket ett interface inte uppfyller.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type GraphNodeData = {
  kind: GraphKind;
  level: GraphLevel;
  label: string;
  role: string | undefined;
  description: string | undefined;
  tables: TableInfo[];
  change: FlowChange | undefined;
  findings: ReviewFinding[];
  onResize: (id: string, size: Size) => void;
};

export type GraphNode = Node<GraphNodeData, 'flow'>;

export const FlowNodeView = memo(function FlowNodeView({
  id,
  data,
  selected,
}: NodeProps<GraphNode>): JSX.Element {
  const { status, hovered, asking, focused, hide, ask, zoom } = useNodeState(id, data.findings);
  const system = data.level === 'system';
  const resizeNode = data.onResize;
  const onResize = useCallback(
    (_event: unknown, { width, height }: { width: number; height: number }): void => {
      resizeNode(id, { width, height });
    },
    [id, resizeNode],
  );
  return (
    <div
      className={`graph-node graph-node--${data.kind} graph-node--${data.level} is-${status}${selected ? ' is-selected' : ''}${asking ? ' is-asking' : ''}${focused ? ' is-focused' : ''}${data.change ? ` is-change-${data.change}` : ''}`}
      title={data.description}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={system ? 70 : 54}
        onResize={onResize}
        handleClassName="graph-node__resize-handle"
      />
      <Handle type="target" position={Position.Left} id="in-left" className="graph-handle" />
      <Handle type="source" position={Position.Right} id="out-right" className="graph-handle" />
      <Handle type="source" position={Position.Left} id="out-left" className="graph-handle" />
      <Handle type="target" position={Position.Right} id="in-right" className="graph-handle" />
      <Handle type="source" position={Position.Top} id="out-top" className="graph-handle" />
      <Handle type="target" position={Position.Top} id="in-top" className="graph-handle" />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="graph-handle" />
      <Handle type="target" position={Position.Bottom} id="in-bottom" className="graph-handle" />
      <span className="graph-node__icon">
        <Icon name={data.kind} size={system ? 'lg' : 'md'} />
      </span>
      <span className="graph-node__text">
        <span className="graph-node__kind">
          {data.role ?? t(`kind.${data.kind}`)}
          {data.change && (
            <span className={`graph-node__change is-${data.change}`}>
              {t(`review.${data.change}`)}
            </span>
          )}
        </span>
        <span className="graph-node__label">{data.label}</span>
      </span>
      <FindingFlag findings={data.findings} className="graph-node__flag" />
      {system && (
        <button
          type="button"
          className="graph-node__zoom nodrag nopan"
          title={t('graph.zoomHint', { name: data.label })}
          aria-label={t('graph.zoomHint', { name: data.label })}
          onClick={(event) => {
            event.stopPropagation();
            zoom();
          }}
        >
          <Icon name="zoomIn" size="sm" />
        </button>
      )}
      <AskButton onAsk={ask} />
      <RemoveButton onRemove={hide} />
      {hovered && data.tables.length > 0 && <TablesPopover tables={data.tables} />}
    </div>
  );
});

function TablesPopover({ tables }: { tables: TableInfo[] }): JSX.Element {
  return (
    <div className="graph-tables">
      {tables.map((table) => (
        <div key={table.name} className="graph-tables__table">
          <div className="graph-tables__name">
            <Icon name="db" size="sm" /> {table.name}
            {table.source && (
              <span className="graph-tables__source">
                {table.source.file}:{table.source.line}
              </span>
            )}
          </div>
          {table.description && <div className="graph-tables__desc">{table.description}</div>}
          {table.columns && table.columns.length > 0 && (
            <table className="graph-tables__columns">
              <tbody>
                {table.columns.map((column) => (
                  <tr key={column.name}>
                    <td className="graph-tables__col">{column.name}</td>
                    <td className="graph-tables__type">{column.type}</td>
                    <td className="graph-tables__coldesc">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {table.touchedBy.length > 0 && (
            <div className="graph-tables__touched">
              {table.touchedBy.map((t) => (
                <span key={t.edgeId} className="graph-tables__op">
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
