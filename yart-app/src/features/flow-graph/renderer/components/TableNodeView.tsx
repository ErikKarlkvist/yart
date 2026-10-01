import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { type JSX, memo } from 'react';
import { type NodeKind } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type FlowChange, type ReviewFinding } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { type TableInfo } from '../../model/graph';
import { useNodeState } from './GraphStateContext';
import { AskButton } from './AskButton';
import { FindingFlag } from './FindingFlag';
import { RemoveButton } from './RemoveButton';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type TableNodeData = {
  kind: NodeKind;
  table: TableInfo;
  change: FlowChange | undefined;
  findings: ReviewFinding[];
};

export type TableNode = Node<TableNodeData, 'table'>;

/** En tabell i en inzoomad lagringsnod: rubrik och en rad per kolumn med nyckelikoner. */
export const TableNodeView = memo(function TableNodeView({
  id,
  data,
  selected,
}: NodeProps<TableNode>): JSX.Element {
  const { status, asking, focused, hide, ask } = useNodeState(id, data.findings);
  const { table } = data;
  return (
    <div
      className={`graph-table graph-node--${data.kind} is-${status}${selected ? ' is-selected' : ''}${asking ? ' is-asking' : ''}${focused ? ' is-focused' : ''}${data.change ? ` is-change-${data.change}` : ''}`}
      title={table.description}
    >
      <Handle type="target" position={Position.Left} id="in-left" className="graph-handle" />
      <Handle type="source" position={Position.Right} id="out-right" className="graph-handle" />
      <Handle type="source" position={Position.Left} id="out-left" className="graph-handle" />
      <Handle type="target" position={Position.Right} id="in-right" className="graph-handle" />
      <AskButton onAsk={ask} />
      <RemoveButton onRemove={hide} />
      <FindingFlag findings={data.findings} className="graph-node__flag" />
      <div className="graph-table__header">
        <Icon name="db" size="sm" />
        <span className="graph-table__name">{table.name}</span>
        {table.touchedBy.length > 0 && (
          <span className="graph-table__ops" title={table.touchedBy.map((x) => x.label).join(', ')}>
            {table.touchedBy.length}
          </span>
        )}
      </div>
      <ul className="graph-table__columns">
        {(table.columns ?? []).map((column) => (
          <li key={column.name} className="graph-table__column" title={column.description}>
            <span className="graph-table__key">
              {column.primaryKey && (
                <span className="graph-table__pk" title={t('table.primaryKey')}>
                  <Icon name="key" size="sm" />
                </span>
              )}
              {column.references && (
                <span
                  className="graph-table__fk"
                  title={t('table.references', {
                    target: `${column.references.table}.${column.references.column}`,
                  })}
                >
                  <Icon name="link" size="sm" />
                </span>
              )}
            </span>
            <span className="graph-table__colname">{column.name}</span>
            <span className="graph-table__type">{column.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
