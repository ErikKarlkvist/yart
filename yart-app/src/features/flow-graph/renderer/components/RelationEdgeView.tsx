import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { type JSX, memo } from 'react';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type RelationEdgeData = {
  label: string;
  offset: number;
};

export type RelationEdge = Edge<RelationEdgeData, 'relation'>;

/** Främmande nyckel mellan två tabeller. Streckad, spelas inte upp. */
export const RelationEdgeView = memo(function RelationEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationEdge>): JSX.Element | null {
  if (!data) return null;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: sourceY + data.offset,
    targetX,
    targetY: targetY + data.offset,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className="graph-relation"
        markerEnd="url(#graph-arrow-relation)"
      />
      <EdgeLabelRenderer>
        <div
          className="graph-relation-label"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)` }}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
