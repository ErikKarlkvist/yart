import {
  type DataTable,
  type Flow,
  type FlowEdge,
  type FlowStep,
  type NodeKind,
  type SourceRef,
  type SystemKind,
} from '@/common/model/flow';
import { type FlowChange, type FlowDiff, type ReviewFinding } from '@/common/model/review';

export type GraphKind = NodeKind | SystemKind;
/** system: ett helt system. node: en nod i koden. table: en tabell i en inzoomad lagringsnod. */
export type GraphLevel = 'system' | 'node' | 'table';

/** En tabell och de anrop i flödet som rör den. */
export interface TableInfo extends DataTable {
  touchedBy: { edgeId: string; label: string }[];
}

/** En ritad nod: antingen ett helt system eller en enskild nod i koden. */
export interface GraphNode {
  id: string;
  level: GraphLevel;
  kind: GraphKind;
  label: string;
  role: string | undefined;
  description: string | undefined;
  source: SourceRef | undefined;
  /** Systemet noden tillhör eller är */
  systemId: string;
  /** För level table: lagringsnoden i flödet som tabellen hör till */
  memberOf: string | undefined;
  /** Tabeller noden lagrar, med anropen som rör dem. Tom för det mesta utom db och cache. */
  tables: TableInfo[];
  /** För level table: tabellen noden visar */
  table?: TableInfo;
  /** För level table: antal kolumner, styr nodens höjd i layouten */
  columnCount?: number;
  /** I en review: hur noden skiljer sig från base. Ett system ärver sina noders ändringar. */
  change: FlowChange | undefined;
  /** I en review: fynd som gäller noden, eller för ett system dess noder och interna anrop */
  findings: ReviewFinding[];
}

/** Det en review lägger ovanpå flödet när grafen byggs. */
export interface ReviewAnnotations {
  diff: FlowDiff;
  findings: readonly ReviewFinding[];
}

const NO_ANNOTATIONS: ReviewAnnotations = {
  diff: { nodes: new Map(), edges: new Map() },
  findings: [],
};

/** Relation mellan två tabellnoder, från kolumnen med främmande nyckel till tabellen den pekar på. */
interface GraphRelation {
  id: string;
  from: string;
  to: string;
  label: string;
}

/** Ram runt noderna i ett system i detaljvyn. */
interface GraphGroup {
  id: string;
  kind: SystemKind;
  label: string;
}

/**
 * Det som ritas. Kanterna behåller sina id:n från flödet. En kant vars båda
 * ändar hamnar på samma nod är intern för ett hopslaget system: den ritas
 * inte och dess steg spelas inte upp på den här nivån. `steps` är därför
 * en delmängd av flödets steg, samma objekt, så positionen kan följa med
 * när vyn byts.
 */
export interface GraphModel {
  nodes: GraphNode[];
  edges: FlowEdge[];
  steps: FlowStep[];
  groups: GraphGroup[];
  relations: GraphRelation[];
}

export type GraphView =
  { kind: 'system' } | { kind: 'focus'; systemId: string } | { kind: 'detail' };

export function buildModel(
  flow: Flow,
  view: GraphView,
  annotations: ReviewAnnotations = NO_ANNOTATIONS,
): GraphModel {
  switch (view.kind) {
    case 'system':
      return collapse(flow, () => true, annotations);
    case 'focus':
      return collapse(flow, (systemId) => systemId !== view.systemId, annotations);
    case 'detail':
      return collapse(flow, () => false, annotations);
  }
}

/** Slår ihop noderna i de system `shouldCollapse` säger ja till, till en nod per system. */
function collapse(
  flow: Flow,
  shouldCollapse: (systemId: string) => boolean,
  annotations: ReviewAnnotations,
): GraphModel {
  const { diff, findings } = annotations;
  const nodeFindings = (id: string): ReviewFinding[] => findings.filter((f) => f.nodeId === id);
  const nodeToTarget = new Map<string, string>();
  const nodes: GraphNode[] = [];
  const groups: GraphGroup[] = [];
  const relations: GraphRelation[] = [];
  const expandedTables = new Set<string>();

  for (const system of flow.systems) {
    const members = flow.nodes.filter((n) => n.system === system.id);
    // Ett system utan noder deltar inte i flödet och ritas inte
    if (members.length === 0) continue;
    if (shouldCollapse(system.id)) {
      nodes.push({
        id: system.id,
        level: 'system',
        kind: system.kind,
        label: system.label,
        role: undefined,
        description: system.description,
        source: undefined,
        systemId: system.id,
        memberOf: undefined,
        tables: tablesOf(flow, members),
        change: systemChange(members, diff),
        findings: systemFindings(flow, members, findings),
      });
      for (const member of members) nodeToTarget.set(member.id, system.id);
    } else {
      if (members.length > 0)
        groups.push({ id: system.id, kind: system.kind, label: system.label });
      for (const member of members) {
        if (member.tables && member.tables.length > 0) {
          // Lagringsnod med tabeller visas som en ruta per tabell
          expandedTables.add(member.id);
          for (const info of tablesOf(flow, [member])) {
            nodes.push({
              id: tableNodeId(member.id, info.name),
              level: 'table',
              kind: member.kind,
              label: info.name,
              role: undefined,
              description: info.description,
              source: info.source,
              systemId: system.id,
              memberOf: member.id,
              tables: [],
              table: info,
              columnCount: info.columns?.length ?? 0,
              change: diff.nodes.get(member.id) ?? member.highlight,
              findings: nodeFindings(member.id),
            });
            for (const column of info.columns ?? []) {
              if (!column.references) continue;
              relations.push({
                id: `relation:${member.id}:${info.name}.${column.name}`,
                from: tableNodeId(member.id, info.name),
                to: tableNodeId(member.id, column.references.table),
                label: `${column.name} → ${column.references.column}`,
              });
            }
          }
          continue;
        }
        nodes.push({
          id: member.id,
          level: 'node',
          kind: member.kind,
          label: member.label,
          role: member.role,
          description: member.description,
          source: member.source,
          systemId: system.id,
          memberOf: undefined,
          tables: tablesOf(flow, [member]),
          change: diff.nodes.get(member.id) ?? member.highlight,
          findings: nodeFindings(member.id),
        });
        nodeToTarget.set(member.id, member.id);
      }
    }
  }

  const edges = flow.edges.map((edge) => ({
    ...edge,
    from: nodeToTarget.get(edge.from) ?? edge.from,
    to: targetForEdge(flow, edge, nodeToTarget, expandedTables),
  }));
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const steps = flow.steps.filter((step) => {
    const edge = edgeById.get(step.edgeId);
    return !edge || edge.from !== edge.to;
  });

  return { nodes, edges, steps, groups, relations };
}

/**
 * Hittar motsvarande steg i en annan modell: samma steg om det finns, annars
 * det närmast föregående steget i flödet som finns i målmodellen.
 */
export function mapStepIndex(
  flow: Flow,
  from: GraphModel,
  fromIndex: number,
  to: GraphModel,
): number {
  const step = from.steps[fromIndex];
  if (!step) return 0;
  const direct = to.steps.indexOf(step);
  if (direct !== -1) return direct;
  const original = flow.steps.indexOf(step);
  let best = 0;
  to.steps.forEach((candidate, i) => {
    if (flow.steps.indexOf(candidate) <= original) best = i;
  });
  return best;
}

/** Ett system är nytt eller borttaget om alla dess noder är det, annars ändrat om någon är. */
function systemChange(
  members: readonly Flow['nodes'][number][],
  diff: FlowDiff,
): FlowChange | undefined {
  const changes = members.map((m) => diff.nodes.get(m.id) ?? m.highlight);
  if (changes.every((c) => c === 'added')) return 'added';
  if (changes.every((c) => c === 'removed')) return 'removed';
  return changes.some((c) => c !== undefined) ? 'changed' : undefined;
}

/** Fynd på systemets noder och på anrop som stannar inom systemet. */
function systemFindings(
  flow: Flow,
  members: readonly Flow['nodes'][number][],
  findings: readonly ReviewFinding[],
): ReviewFinding[] {
  const memberIds = new Set(members.map((m) => m.id));
  const internalEdges = new Set(
    flow.edges.filter((e) => memberIds.has(e.from) && memberIds.has(e.to)).map((e) => e.id),
  );
  return findings.filter(
    (f) =>
      (f.nodeId !== undefined && memberIds.has(f.nodeId)) ||
      (f.edgeId !== undefined && internalEdges.has(f.edgeId)),
  );
}

function tableNodeId(nodeId: string, table: string): string {
  return `table:${nodeId}:${table}`;
}

/**
 * Målet för en kant. Går kanten till en lagringsnod som visas som tabeller
 * pekar den på den första tabellen kanten rör, annars på nodens första tabell.
 */
function targetForEdge(
  flow: Flow,
  edge: FlowEdge,
  nodeToTarget: Map<string, string>,
  expandedTables: Set<string>,
): string {
  if (expandedTables.has(edge.to)) {
    const node = flow.nodes.find((n) => n.id === edge.to);
    const table = edge.tables?.[0] ?? node?.tables?.[0]?.name;
    if (table) return tableNodeId(edge.to, table);
  }
  return nodeToTarget.get(edge.to) ?? edge.to;
}

/** Tabellerna hos ett antal noder, med de kanter i flödet som rör varje tabell. */
function tablesOf(flow: Flow, members: readonly Flow['nodes'][number][]): TableInfo[] {
  return members.flatMap((member) =>
    (member.tables ?? []).map((table) => ({
      ...table,
      touchedBy: flow.edges
        .filter((e) => e.to === member.id && e.tables?.includes(table.name))
        .map((e) => ({ edgeId: e.id, label: e.label })),
    })),
  );
}

/**
 * En ritad linje mellan två noder. Alla flödeskanter som går samma väg
 * ritas som en linje, så fram och tillbaka mellan två noder blir en linje
 * åt varje håll oavsett hur många anrop som görs.
 */
export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  /** I flödets ordning */
  members: FlowEdge[];
}

export function visualEdgeId(from: string, to: string): string {
  return `visual:${from}>${to}`;
}

/** Slår ihop kanterna per riktning. Självkanter ritas inte och hoppas över. */
export function groupEdges(edges: readonly FlowEdge[]): VisualEdge[] {
  const byRoute = new Map<string, VisualEdge>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const id = visualEdgeId(edge.from, edge.to);
    const existing = byRoute.get(id);
    if (existing) existing.members.push(edge);
    else byRoute.set(id, { id, from: edge.from, to: edge.to, members: [edge] });
  }
  return [...byRoute.values()];
}

/**
 * Tar bort noder användaren dolt, med kanterna som rör dem och stegen som
 * spelar upp de kanterna. Ett dolt system döljer alla sina noder, en dold
 * lagringsnod döljer sina tabeller. Stegobjekten behålls så positionen kan
 * följa med när vyn byts.
 */
export function hideElements(
  model: GraphModel,
  hiddenNodes: ReadonlySet<string>,
  hiddenEdges: ReadonlySet<string>,
): GraphModel {
  if (hiddenNodes.size === 0 && hiddenEdges.size === 0) return model;
  const isHidden = (node: GraphNode): boolean =>
    hiddenNodes.has(node.id) ||
    hiddenNodes.has(node.systemId) ||
    (node.memberOf !== undefined && hiddenNodes.has(node.memberOf));
  const nodes = model.nodes.filter((node) => !isHidden(node));
  const kept = new Set(nodes.map((n) => n.id));
  const edges = model.edges.filter(
    (edge) => !hiddenEdges.has(edge.id) && kept.has(edge.from) && kept.has(edge.to),
  );
  const edgeIds = new Set(edges.map((e) => e.id));
  return {
    nodes,
    edges,
    steps: model.steps.filter((step) => edgeIds.has(step.edgeId)),
    groups: model.groups.filter((group) =>
      nodes.some((n) => n.systemId === group.id && n.level !== 'system'),
    ),
    relations: model.relations.filter((r) => kept.has(r.from) && kept.has(r.to)),
  };
}
