import {
  Background,
  BackgroundVariant,
  type EdgeChange,
  type EdgeMouseHandler,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeTypes,
  ReactFlow,
} from '@xyflow/react';
import { type JSX, type ReactNode, useCallback, useMemo, useState } from 'react';
import { type FlowEdge } from '@/common/model/flow';
import { type FlowDiff, type ReviewFinding } from '@/common/model/review';
import { type AskTarget } from '../../model/ask';
import {
  type GraphModel,
  type GraphNode as ModelNode,
  groupEdges,
  type VisualEdge,
} from '../../model/graph';
import {
  GROUP_LABEL_HEIGHT,
  GROUP_PADDING,
  layoutFlow,
  nodeSize,
  type Point,
  type Rect,
  type Size,
  type Direction,
} from '../../model/layout';
import { type StepStatus, stepView } from '../../model/playback';
import { combinedHighlight, edgeHighlight } from '../../model/highlight';
import { type EdgeMemberData, FlowEdgeView, type GraphEdge } from './FlowEdgeView';
import { FlowNodeView, type GraphNode } from './FlowNodeView';
import { GraphStateContext } from './GraphStateContext';
import { GroupNodeView, type GroupNode } from './GroupNodeView';
import { RelationEdgeView, type RelationEdge } from './RelationEdgeView';
import { TableNodeView, type TableNode } from './TableNodeView';

const nodeTypes: NodeTypes = {
  flow: FlowNodeView,
  systemGroup: GroupNodeView,
  table: TableNodeView,
};
const edgeTypes: EdgeTypes = { flow: FlowEdgeView, relation: RelationEdgeView };
const STATUSES = ['pending', 'active', 'done'] as const;

type AnyNode = GraphNode | GroupNode | TableNode;
type AnyEdge = GraphEdge | RelationEdge;

interface Props {
  model: GraphModel;
  stepIndex: number;
  /** Noder användaren flyttat, övre vänstra hörnet per nod-id */
  moved: ReadonlyMap<string, Point>;
  onMove: (nodeId: string, position: Point) => void;
  onHideNodes: (nodeIds: string[]) => void;
  /** Flödeskanternas id:n, inte linjernas */
  onHideEdges: (edgeIds: string[]) => void;
  onNodeClick?: ((node: ModelNode) => void) | undefined;
  onEdgeClick?: ((edge: FlowEdge) => void) | undefined;
  /** Det som är utpekat i frågerutan, markeras i grafen */
  asking: AskTarget | null;
  onAsk: (target: AskTarget) => void;
  /** Förstoringsglaset på en systemnod */
  onZoom?: ((systemId: string) => void) | undefined;
  /** Förstoringsglaset på en systemram */
  onZoomOut?: (() => void) | undefined;
  /** Hopp i uppspelningen från listan över anrop på en linje, 0-baserat */
  onGoToStep: (index: number) => void;
  /** I en review: ändringar och fynd att rita på kanterna. Noderna bär sina i modellen. */
  diff: FlowDiff | null;
  findings: readonly ReviewFinding[];
  focusedFindingId: string | null;
  onFocusFinding: (findingId: string) => void;
  /** Ritas ovanpå grafen, t.ex. frågerutan */
  overlay?: ReactNode;
}

export function FlowGraph({
  model,
  stepIndex,
  moved,
  onMove,
  onHideNodes,
  onHideEdges,
  onNodeClick,
  onEdgeClick,
  asking,
  onAsk,
  onZoom,
  onZoomOut,
  onGoToStep,
  diff,
  findings,
  focusedFindingId,
  onFocusFinding,
  overlay,
}: Props): JSX.Element {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<string | null>(null);
  const togglePinned = useCallback((edgeId: string) => {
    setPinnedEdge((current) => (current === edgeId ? null : edgeId));
  }, []);
  const unpin = useCallback(() => {
    setPinnedEdge(null);
  }, []);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [nodeSizes, setNodeSizes] = useState<ReadonlyMap<string, Size>>(() => new Map());
  // Nodobjekt som inte ändrats återanvänds, annars mäter React Flow om dem och grafen
  // flimrar vid drag. Cachen är en muterbar Map som lever lika länge som komponenten.
  const [nodeCache] = useState(() => new Map<string, AnyNode>());
  const visualEdges = useMemo(() => groupEdges(model.edges), [model]);
  const layout = useMemo(() => layoutFlow({ ...model, edges: visualEdges }), [model, visualEdges]);
  const view = useMemo(() => stepView(model, stepIndex), [model, stepIndex]);
  const sizeOf = useCallback(
    (node: ModelNode): Size => nodeSizes.get(node.id) ?? nodeSize(node),
    [nodeSizes],
  );
  const onResize = useCallback((id: string, size: Size): void => {
    setNodeSizes((current) => {
      const next = new Map(current);
      next.set(id, size);
      return next;
    });
  }, []);

  const positionOf = useCallback(
    (nodeId: string): Point => moved.get(nodeId) ?? layout.positions.get(nodeId) ?? { x: 0, y: 0 },
    [moved, layout],
  );

  const nodes = useMemo<AnyNode[]>(() => {
    // Ramen följer noderna, så den växer när man drar ut en nod ur den.
    const groups: GroupNode[] = model.groups.flatMap((group) => {
      const members = model.nodes.filter((n) => n.systemId === group.id && n.level !== 'system');
      const rect = boundingRect(members.map((n) => ({ ...positionOf(n.id), ...sizeOf(n) })));
      if (!rect) return [];
      return [
        {
          id: `group:${group.id}`,
          type: 'systemGroup',
          position: { x: rect.x - GROUP_PADDING, y: rect.y - GROUP_LABEL_HEIGHT },
          style: {
            width: rect.width + 2 * GROUP_PADDING,
            height: rect.height + GROUP_LABEL_HEIGHT + GROUP_PADDING,
          },
          zIndex: -1,
          selectable: false,
          draggable: false,
          data: { kind: group.kind, label: group.label },
        },
      ];
    });

    // Bara sådant som är stabilt över hover och uppspelning ligger i noddatan.
    const flowNodes: (GraphNode | TableNode)[] = model.nodes.map((node) => {
      const position = positionOf(node.id);
      const isSelected = selected.has(node.id);
      if (node.level === 'table' && node.table && node.kind !== 'app' && node.kind !== 'api') {
        return {
          id: node.id,
          type: 'table',
          position,
          draggable: true,
          selected: isSelected,
          data: {
            kind: node.kind,
            table: node.table,
            change: node.change,
            findings: node.findings,
          },
        };
      }
      return {
        id: node.id,
        type: 'flow',
        position,
        draggable: true,
        selected: isSelected,
        style: sizeOf(node),
        data: {
          kind: node.kind,
          level: node.level,
          label: node.label,
          role: node.role,
          description: node.description,
          tables: node.tables,
          change: node.change,
          findings: node.findings,
          trigger: node.trigger,
          memberCount: node.memberCount,
          onResize,
        },
      };
    });

    return reuseUnchanged(nodeCache, [...groups, ...flowNodes]);
  }, [model, positionOf, selected, nodeCache, sizeOf, onResize]);

  const askEdge = useCallback(
    (memberId: string) => {
      const edge = model.edges.find((e) => e.id === memberId);
      if (edge) onAsk({ kind: 'edge', edge });
    },
    [model, onAsk],
  );

  const edges = useMemo<AnyEdge[]>(() => {
    const stepsByEdge = new Map<string, number[]>();
    model.steps.forEach((step, i) => {
      stepsByEdge.set(step.edgeId, [...(stepsByEdge.get(step.edgeId) ?? []), i + 1]);
    });
    const relations: RelationEdge[] = model.relations.map((relation) => {
      const placement = layout.placements.get(relation.id);
      const handles = edgeHandles(placement?.direction ?? 'forward');
      return {
        id: relation.id,
        type: 'relation',
        source: relation.from,
        target: relation.to,
        ...handles,
        selectable: false,
        data: { label: relation.label, offset: placement?.offset ?? 0 },
      };
    });
    const flowEdges: GraphEdge[] = visualEdges.map((edge) => {
      const placement = layout.placements.get(edge.id);
      const handles = edgeHandles(placement?.direction ?? 'forward');
      const open = hoveredEdge === edge.id;
      const askingId =
        asking?.kind === 'edge' && edge.members.some((m) => m.id === asking.edge.id)
          ? asking.edge.id
          : null;
      const members: EdgeMemberData[] = edge.members.map((m) => ({
        id: m.id,
        label: m.label,
        payload: m.payload,
        response: m.response,
        status: view.edges.get(m.id) ?? 'pending',
        steps: stepsByEdge.get(m.id) ?? [],
        change: diff?.edges.get(m.id) ?? m.highlight,
        findings: findings.filter((f) => f.edgeId === m.id),
      }));
      return {
        id: edge.id,
        type: 'flow',
        source: edge.from,
        target: edge.to,
        // Öppen kant lyfts ovanför noder och andra kanter
        zIndex: open ? 1000 : 0,
        selected: selected.has(edge.id),
        ...handles,
        data: {
          members,
          status: combinedStatus(members),
          offset: placement?.offset ?? 0,
          direction: placement?.direction ?? 'forward',
          hovered: open,
          askingId,
          onAsk: askEdge,
          pinned: pinnedEdge === edge.id,
          onTogglePinned: togglePinned,
          onGoToStep,
          highlight: combinedHighlight(members.map((m) => edgeHighlight(m.change, m.findings))),
          focused:
            focusedFindingId !== null &&
            members.some((m) => m.findings.some((f) => f.id === focusedFindingId)),
        },
      };
    });
    return [...relations, ...flowEdges];
  }, [
    model,
    visualEdges,
    layout,
    view,
    hoveredEdge,
    selected,
    asking,
    askEdge,
    pinnedEdge,
    togglePinned,
    onGoToStep,
    diff,
    findings,
    focusedFindingId,
  ]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AnyNode>[]) => {
      const removed: string[] = [];
      for (const change of changes) {
        if (change.type === 'position' && change.position) onMove(change.id, change.position);
        else if (change.type === 'remove') removed.push(change.id);
        else if (change.type === 'select') {
          setSelected((current) => toggleSelected(current, change.id, change.selected));
        }
      }
      if (removed.length > 0) onHideNodes(removed.filter((id) => !id.startsWith('group:')));
    },
    [onMove, onHideNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<AnyEdge>[]) => {
      const removed: string[] = [];
      for (const change of changes) {
        if (change.type === 'remove') removed.push(change.id);
        else if (change.type === 'select') {
          setSelected((current) => toggleSelected(current, change.id, change.selected));
        }
      }
      if (removed.length > 0) onHideEdges(memberIds(visualEdges, removed));
    },
    [visualEdges, onHideEdges],
  );

  const onEdgeMouseEnter = useCallback<EdgeMouseHandler<AnyEdge>>((_, edge) => {
    if (edge.type === 'flow') setHoveredEdge(edge.id);
  }, []);
  const onEdgeMouseLeave = useCallback<EdgeMouseHandler<AnyEdge>>(() => {
    setHoveredEdge(null);
  }, []);
  const onNodeMouseEnter = useCallback<NodeMouseHandler<Node>>((_, node) => {
    setHoveredNode(node.id);
  }, []);
  const onNodeMouseLeave = useCallback<NodeMouseHandler<Node>>(() => {
    setHoveredNode(null);
  }, []);
  const handleNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_, node) => {
      const found = model.nodes.find((n) => n.id === node.id);
      if (found) onNodeClick?.(found);
    },
    [model, onNodeClick],
  );
  // Klick på en linje öppnar anropet som spelas upp, annars det första på linjen.
  const handleEdgeClick = useCallback<EdgeMouseHandler<AnyEdge>>(
    (_, edge) => {
      const visual = visualEdges.find((v) => v.id === edge.id);
      if (!visual) return;
      const active = visual.members.find((m) => view.edges.get(m.id) === 'active');
      const found = active ?? visual.members[0];
      if (found) onEdgeClick?.(found);
    },
    [visualEdges, view, onEdgeClick],
  );

  const hide = useCallback(
    (nodeId: string) => {
      onHideNodes([nodeId]);
    },
    [onHideNodes],
  );
  const askNode = useCallback(
    (nodeId: string) => {
      const node = model.nodes.find((n) => n.id === nodeId);
      if (node) onAsk({ kind: 'node', node });
    },
    [model, onAsk],
  );
  const askingNodeId = asking?.kind === 'node' ? asking.node.id : null;
  const zoomInto = useCallback(
    (systemId: string) => {
      onZoom?.(systemId);
    },
    [onZoom],
  );
  const zoomOut = useCallback(() => {
    onZoomOut?.();
  }, [onZoomOut]);
  const graphState = useMemo(
    () => ({
      hoveredNodeId: hoveredNode,
      view,
      hide,
      askNode,
      askingNodeId,
      zoomInto,
      zoomOut,
      focusedFindingId,
      focusFinding: onFocusFinding,
    }),
    [
      hoveredNode,
      view,
      hide,
      askNode,
      askingNodeId,
      zoomInto,
      zoomOut,
      focusedFindingId,
      onFocusFinding,
    ],
  );

  return (
    <div className="graph">
      <GraphStateContext.Provider value={graphState}>
        <svg className="graph__defs">
          <defs>
            {[
              ...STATUSES,
              'relation',
              'highlight-added',
              'highlight-changed',
              'highlight-removed',
              'highlight-problem',
              'highlight-warning',
            ].map((status) => (
              <marker
                key={status}
                id={`graph-arrow-${status}`}
                className={`graph-arrow is-${status}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            ))}
          </defs>
        </svg>
        <ReactFlow<AnyNode, AnyEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          nodesConnectable={false}
          elementsSelectable
          elevateEdgesOnSelect
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={unpin}
        >
          <Background variant={BackgroundVariant.Lines} gap={24} color="var(--grid)" />
        </ReactFlow>
        {overlay}
      </GraphStateContext.Provider>
    </div>
  );
}

function edgeHandles(direction: Direction): { sourceHandle: string; targetHandle: string } {
  switch (direction) {
    case 'backward':
      return { sourceHandle: 'out-left', targetHandle: 'in-right' };
    case 'up':
      return { sourceHandle: 'out-top', targetHandle: 'in-bottom' };
    case 'down':
      return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
    case 'forward':
      return { sourceHandle: 'out-right', targetHandle: 'in-left' };
  }
}

function combinedStatus(members: readonly { status: StepStatus }[]): StepStatus {
  if (members.some((m) => m.status === 'active')) return 'active';
  if (members.some((m) => m.status === 'done')) return 'done';
  return 'pending';
}

function toggleSelected(
  current: ReadonlySet<string>,
  id: string,
  isSelected: boolean,
): ReadonlySet<string> {
  if (current.has(id) === isSelected) return current;
  const next = new Set(current);
  if (isSelected) next.add(id);
  else next.delete(id);
  return next;
}

function memberIds(visualEdges: readonly VisualEdge[], visualIds: readonly string[]): string[] {
  return visualEdges
    .filter((v) => visualIds.includes(v.id))
    .flatMap((v) => v.members.map((m) => m.id));
}

/**
 * Byter ut varje nytt nodobjekt mot det cachade om inget i det ändrats, så
 * att bara noden som flyttas eller markeras får ny identitet.
 */
function reuseUnchanged(cache: Map<string, AnyNode>, next: AnyNode[]): AnyNode[] {
  const result = next.map((node) => {
    const cached = cache.get(node.id);
    return cached && sameNode(cached, node) ? cached : node;
  });
  cache.clear();
  for (const node of result) cache.set(node.id, node);
  return result;
}

function sameNode(a: AnyNode, b: AnyNode): boolean {
  return (
    a.type === b.type &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.selected === b.selected &&
    shallowEqual(a.data, b.data) &&
    shallowEqual(a.style, b.style)
  );
}

function shallowEqual(a: object | undefined, b: object | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(
    (key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key],
  );
}

function boundingRect(rects: readonly Rect[]): Rect | null {
  const first = rects[0];
  if (!first) return null;
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
