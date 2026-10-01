import dagre from '@dagrejs/dagre';
import { type GraphLevel } from './graph';

export interface Size {
  width: number;
  height: number;
}

export const NODE_SIZES: Readonly<Record<GraphLevel, Size>> = {
  node: { width: 190, height: 58 },
  system: { width: 220, height: 76 },
  table: { width: 230, height: 40 },
};

const TABLE_HEADER_HEIGHT = 34;
const TABLE_ROW_HEIGHT = 22;

/** Tabellnoder växer med antalet kolumner. */
export function nodeSize(node: { level: GraphLevel; columnCount?: number }): Size {
  const base = NODE_SIZES[node.level];
  if (node.level !== 'table') return base;
  return {
    width: base.width,
    height: TABLE_HEADER_HEIGHT + (node.columnCount ?? 0) * TABLE_ROW_HEIGHT + 8,
  };
}

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'forward' | 'backward' | 'up' | 'down';

interface EdgePlacement {
  /** Går kanten åt höger (forward) eller tillbaka åt vänster (backward) */
  direction: Direction;
  /** Förskjutning i pixlar för att skilja parallella kanter mellan samma noder */
  offset: number;
}

export interface Rect extends Point, Size {}

export interface Layout {
  /** Övre vänstra hörnet per nod-id */
  positions: Map<string, Point>;
  placements: Map<string, EdgePlacement>;
  /** Ram per grupp-id, beräknad av layouten så grupperna hålls ihop */
  groupRects: Map<string, Rect>;
}

/** Det layouten behöver veta om en graf. */
export interface LayoutInput {
  nodes: readonly { id: string; level: GraphLevel; systemId: string; columnCount?: number }[];
  edges: readonly { id: string; from: string; to: string }[];
  groups: readonly { id: string }[];
  /** Relationer mellan tabeller, påverkar placeringen men spelas inte upp */
  relations?: readonly { id: string; from: string; to: string }[];
}

export const GROUP_PADDING = 18;
export const GROUP_LABEL_HEIGHT = 30;

const PARALLEL_GAP = 34;
const SIDE_BRANCH_GAP = 80;

/** Placerar noderna vänster till höger med dagre och räknar ut kanternas riktning och förskjutning. */
export function layoutFlow(input: LayoutInput): Layout {
  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setGraph({ rankdir: 'LR', nodesep: 44, ranksep: 190, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));

  // Grupper blir kluster så dagre håller ihop ett systems noder.
  const groupIds = new Set(input.groups.map((g) => g.id));
  for (const id of groupIds) {
    graph.setNode(clusterId(id), {
      paddingLeft: GROUP_PADDING,
      paddingRight: GROUP_PADDING,
      paddingTop: GROUP_LABEL_HEIGHT,
      paddingBottom: GROUP_PADDING,
    });
  }
  // dagre skriver koordinater in i objektet, så varje nod måste få sin egen kopia.
  for (const node of input.nodes) {
    graph.setNode(node.id, { ...nodeSize(node) });
    if (node.level !== 'system' && groupIds.has(node.systemId)) {
      graph.setParent(node.id, clusterId(node.systemId));
    }
  }
  // Bara framåtriktade kanter påverkar rangordningen. En kant är "framåt" första
  // gången paret ses, så svar tillbaka inte drar isär layouten. Självkanter ignoreras.
  const allEdges = [...input.edges, ...(input.relations ?? [])];
  const seenPairs = new Set<string>();
  const outgoing = new Map<string, Set<string>>();
  const neighbours = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    const key = pairKey(edge.from, edge.to);
    if (seenPairs.has(key) || edge.from === edge.to) continue;
    seenPairs.add(key);
    addNeighbour(outgoing, edge.from, edge.to);
    addNeighbour(neighbours, edge.from, edge.to);
    addNeighbour(neighbours, edge.to, edge.from);
    graph.setEdge(edge.from, edge.to);
  }
  dagre.layout(graph);

  const positions = new Map<string, Point>();
  for (const node of input.nodes) {
    // dagre ger centrum, React Flow vill ha övre vänstra hörnet
    const placed = graph.node(node.id) as Point;
    const size = nodeSize(node);
    positions.set(node.id, { x: placed.x - size.width / 2, y: placed.y - size.height / 2 });
  }

  // En direkt väg och en omväg via ett mellanliggande system bildar en triangel.
  // Håll den direkta vägen rak och lägg mellansystemet centrerat ovanför/under.
  alignBypassPaths(input, positions, outgoing, neighbours);

  // En kort sidogren behöver inte förlänga huvudflödet åt höger. Lägg en
  // slutpunkt ovanför eller nedanför dess förälder när en annan gren fortsätter.
  const verticalPairs = placeSideBranches(input, positions, outgoing, neighbours);

  const groupRects = new Map<string, Rect>();
  for (const id of groupIds) {
    const cluster = graph.node(clusterId(id)) as Point & Size;
    groupRects.set(id, {
      x: cluster.x - cluster.width / 2,
      y: cluster.y - cluster.height / 2,
      width: cluster.width,
      height: cluster.height,
    });
  }

  const placements = placeEdges({ ...input, edges: allEdges }, positions, verticalPairs);
  return { positions, placements, groupRects };
}

function clusterId(groupId: string): string {
  return `cluster:${groupId}`;
}

function addNeighbour(map: Map<string, Set<string>>, from: string, to: string): void {
  const targets = map.get(from) ?? new Set<string>();
  targets.add(to);
  map.set(from, targets);
}

function isSideLeaf(
  id: string,
  outgoing: Map<string, Set<string>>,
  neighbours: Map<string, Set<string>>,
): boolean {
  const adjacent = neighbours.get(id);
  if (adjacent?.size !== 1) return false;
  const parentId = adjacent.values().next().value;
  return Boolean(
    parentId &&
    outgoing.get(parentId)?.has(id) &&
    [...(outgoing.get(parentId) ?? [])].some(
      (otherId) => otherId !== id && (neighbours.get(otherId)?.size ?? 0) > 1,
    ),
  );
}

function alignBypassPaths(
  input: LayoutInput,
  positions: Map<string, Point>,
  outgoing: Map<string, Set<string>>,
  neighbours: Map<string, Set<string>>,
): void {
  if (input.nodes.some((node) => node.level !== 'system')) return;
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  const used = new Set<string>();
  for (const [fromId, targets] of outgoing) {
    for (const toId of targets) {
      const middleId = [...targets].find((id) => id !== toId && outgoing.get(id)?.has(toId));
      if (!middleId || [fromId, middleId, toId].some((id) => used.has(id))) continue;
      const from = positions.get(fromId);
      const middle = positions.get(middleId);
      const to = positions.get(toId);
      const fromNode = byId.get(fromId);
      const middleNode = byId.get(middleId);
      const toNode = byId.get(toId);
      if (!from || !middle || !to || !fromNode || !middleNode || !toNode) continue;
      if (!(from.x < middle.x && middle.x < to.x)) continue;

      const size = nodeSize(middleNode);
      const x = (from.x + to.x) / 2;
      const obstacles = input.nodes.flatMap((node) => {
        if ([fromId, middleId, toId].includes(node.id) || isSideLeaf(node.id, outgoing, neighbours))
          return [];
        const position = positions.get(node.id);
        return position ? [{ ...position, ...nodeSize(node) }] : [];
      });
      for (const y of [from.y, to.y]) {
        const fromRect = { x: from.x, y, ...nodeSize(fromNode) };
        const toRect = { x: to.x, y, ...nodeSize(toNode) };
        if (obstacles.some((rect) => overlaps(rect, fromRect) || overlaps(rect, toRect))) continue;
        const above = nearestFreePosition(
          x,
          y - size.height - SIDE_BRANCH_GAP,
          -1,
          size,
          obstacles,
        );
        const below = nearestFreePosition(
          x,
          y + nodeSize(fromNode).height + SIDE_BRANCH_GAP,
          1,
          size,
          obstacles,
        );
        const aboveDistance = y - (above.y + size.height);
        const belowDistance = below.y - (y + nodeSize(fromNode).height);
        const middlePosition = aboveDistance <= belowDistance ? above : below;
        positions.set(fromId, { x: from.x, y });
        positions.set(toId, { x: to.x, y });
        positions.set(middleId, middlePosition);
        used.add(fromId);
        used.add(middleId);
        used.add(toId);
        break;
      }
    }
  }
}

function placeSideBranches(
  input: LayoutInput,
  positions: Map<string, Point>,
  outgoing: Map<string, Set<string>>,
  neighbours: Map<string, Set<string>>,
): Set<string> {
  const verticalPairs = new Set<string>();
  // Detaljvyns grupper behöver Dagres egen placering; sidogrenar gäller systemvyn.
  if (input.nodes.some((node) => node.level !== 'system')) return verticalPairs;
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  const placed: Rect[] = [];
  const moved = new Set<string>();

  for (const leaf of input.nodes) {
    if (!isSideLeaf(leaf.id, outgoing, neighbours)) continue;
    const parentId = neighbours.get(leaf.id)?.values().next().value;
    if (!parentId) continue;

    const parent = byId.get(parentId);
    const parentPosition = positions.get(parentId);
    if (!parent || !parentPosition) continue;
    const size = nodeSize(leaf);
    const parentSize = nodeSize(parent);
    const x = parentPosition.x + (parentSize.width - size.width) / 2;
    const occupied = input.nodes.flatMap((node) => {
      if (node.id === leaf.id || moved.has(node.id)) return [];
      const position = positions.get(node.id);
      return position ? [{ ...position, ...nodeSize(node) }] : [];
    });
    const obstacles = [...occupied, ...placed];
    const above = nearestFreePosition(
      x,
      parentPosition.y - size.height - SIDE_BRANCH_GAP,
      -1,
      size,
      obstacles,
    );
    const below = nearestFreePosition(
      x,
      parentPosition.y + parentSize.height + SIDE_BRANCH_GAP,
      1,
      size,
      obstacles,
    );
    const aboveDistance = parentPosition.y - (above.y + size.height);
    const belowDistance = below.y - (parentPosition.y + parentSize.height);
    const position = aboveDistance <= belowDistance ? above : below;
    positions.set(leaf.id, position);
    moved.add(leaf.id);
    placed.push({ ...position, ...size });
    verticalPairs.add(pairKey(parentId, leaf.id));
  }
  return verticalPairs;
}

function nearestFreePosition(
  x: number,
  startY: number,
  side: -1 | 1,
  size: Size,
  obstacles: readonly Rect[],
): Point {
  let y = startY;
  while (obstacles.some((rect) => overlaps({ x, y, ...size }, rect))) {
    y += side * (size.height + SIDE_BRANCH_GAP);
  }
  return { x, y };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function placeEdges(
  input: LayoutInput,
  positions: Map<string, Point>,
  verticalPairs: ReadonlySet<string>,
): Map<string, EdgePlacement> {
  const groups = new Map<string, string[]>();
  for (const edge of input.edges) {
    const key = pairKey(edge.from, edge.to);
    const group = groups.get(key) ?? [];
    group.push(edge.id);
    groups.set(key, group);
  }

  const placements = new Map<string, EdgePlacement>();
  for (const edge of input.edges) {
    const group = groups.get(pairKey(edge.from, edge.to)) ?? [edge.id];
    const index = group.indexOf(edge.id);
    const offset = (index - (group.length - 1) / 2) * PARALLEL_GAP;
    const fromX = positions.get(edge.from)?.x ?? 0;
    const toX = positions.get(edge.to)?.x ?? 0;
    const fromY = positions.get(edge.from)?.y ?? 0;
    const toY = positions.get(edge.to)?.y ?? 0;
    const direction = verticalPairs.has(pairKey(edge.from, edge.to))
      ? toY < fromY
        ? 'up'
        : 'down'
      : toX >= fromX
        ? 'forward'
        : 'backward';
    placements.set(edge.id, { direction, offset });
  }
  return placements;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}
