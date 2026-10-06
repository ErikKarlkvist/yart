import {
  type DataTable,
  type Flow,
  type FlowEdge,
  type FlowStep,
  type FlowTrigger,
  type NodeKind,
  type SourceRef,
  type SystemKind,
} from '@/common/model/flow';
import { type FlowChange, type FlowDiff, type ReviewFinding } from '@/common/model/review';
import { allSteps, type AltChoices, resolveSteps } from '@/common/model/steps';

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
  /** För level system: hur många av flödets noder systemet rymmer */
  memberCount?: number;
  /** I en review: hur noden skiljer sig från base. Ett system ärver sina noders ändringar. */
  change: FlowChange | undefined;
  /** I en review: fynd som gäller noden, eller för ett system dess noder och interna anrop */
  findings: ReviewFinding[];
  /** Det som startar flödet, på noden där det börjar eller systemet den ligger i */
  trigger: FlowTrigger | undefined;
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

/** Vilka system som är utfällda, med en nod per del; resten är en nod per system. */
export interface GraphView {
  expanded: 'all' | readonly string[];
}

/** Vyn ett flöde öppnas i: de system flödet säger ska vara utfällda, som finns. */
export function initialView(flow: Flow): GraphView {
  const ids = new Set(flow.systems.map((s) => s.id));
  return { expanded: (flow.expanded ?? []).filter((id) => ids.has(id)) };
}

/** De utfällda systemens id:n, i flödets ordning. */
export function expandedSystems(flow: Flow, view: GraphView): string[] {
  const ids = flow.systems.map((s) => s.id);
  return view.expanded === 'all' ? ids : ids.filter((id) => view.expanded.includes(id));
}

export interface BuildOptions {
  /** Grenarna som spelas i flödets alternativ */
  choices?: AltChoices;
  /**
   * Lagringsnoder med tabeller visas som en ruta per tabell. all: alla tabeller (grafen).
   * touched: bara tabellerna flödets anrop namnger, och bara i noder där något anrop gör det
   * (sekvensdiagrammet).
   */
  tables?: 'all' | 'touched';
}

export function buildModel(
  flow: Flow,
  view: GraphView,
  annotations: ReviewAnnotations = NO_ANNOTATIONS,
  options: BuildOptions = {},
): GraphModel {
  const expanded = new Set(expandedSystems(flow, view));
  return collapse(flow, (systemId) => !expanded.has(systemId), annotations, options);
}

/** Slår ihop noderna i de system `shouldCollapse` säger ja till, till en nod per system. */
function collapse(
  flow: Flow,
  shouldCollapse: (systemId: string) => boolean,
  annotations: ReviewAnnotations,
  { choices, tables = 'all' }: BuildOptions,
): GraphModel {
  const { diff, findings } = annotations;
  const nodeFindings = (id: string): ReviewFinding[] => findings.filter((f) => f.nodeId === id);
  const nodeToTarget = new Map<string, string>();
  const nodes: GraphNode[] = [];
  const groups: GraphGroup[] = [];
  const relations: GraphRelation[] = [];
  /** Lagringsnoder som visas som tabeller, med den första tabellen som visas */
  const expandedTables = new Map<string, string>();

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
        trigger: members.some((m) => m.id === flow.trigger?.nodeId) ? flow.trigger : undefined,
        memberCount: members.length,
      });
      for (const member of members) nodeToTarget.set(member.id, system.id);
    } else {
      if (members.length > 0)
        groups.push({ id: system.id, kind: system.kind, label: system.label });
      for (const member of members) {
        const shown = shownTables(flow, member, tables);
        if (shown[0]) {
          // Lagringsnod med tabeller visas som en ruta per tabell
          expandedTables.set(member.id, shown[0].name);
          for (const info of shown) {
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
              trigger: undefined,
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
          trigger: member.id === flow.trigger?.nodeId ? flow.trigger : undefined,
        });
        nodeToTarget.set(member.id, member.id);
      }
    }
  }

  const answeredFrom = answeringTables(flow, expandedTables);
  const edges = flow.edges.map((edge) => ({
    ...edge,
    from: answeredFrom.get(edge.id) ?? nodeToTarget.get(edge.from) ?? edge.from,
    to: targetForEdge(edge, nodeToTarget, expandedTables),
  }));
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const steps = resolveSteps(flow.steps, choices).filter((step) => {
    const edge = edgeById.get(step.edgeId);
    return !edge || edge.from !== edge.to;
  });

  return { nodes, edges, steps, groups, relations };
}

/**
 * Hittar motsvarande steg i en annan stegföljd: samma steg om det finns, annars
 * det närmast föregående steget i `all`, flödets spelade steg, som finns i målet.
 */
export function mapStepIndex(
  all: readonly FlowStep[],
  from: readonly FlowStep[],
  fromIndex: number,
  to: readonly FlowStep[],
): number {
  const step = from[fromIndex];
  if (!step) return 0;
  const direct = to.indexOf(step);
  if (direct !== -1) return direct;
  const original = all.indexOf(step);
  let best = 0;
  to.forEach((candidate, i) => {
    if (all.indexOf(candidate) <= original) best = i;
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

export function tableNodeId(nodeId: string, table: string): string {
  return `table:${nodeId}:${table}`;
}

/**
 * Målet för en kant. Går kanten till en lagringsnod som visas som tabeller
 * pekar den på den första tabellen kanten rör, annars på den första tabellen som visas.
 */
function targetForEdge(
  edge: FlowEdge,
  nodeToTarget: Map<string, string>,
  expandedTables: ReadonlyMap<string, string>,
): string {
  const first = expandedTables.get(edge.to);
  if (first !== undefined) return tableNodeId(edge.to, edge.tables?.[0] ?? first);
  return nodeToTarget.get(edge.to) ?? edge.to;
}

/** Tabellerna en lagringsnod visas som, eller inga om den ska vara en vanlig nod. */
function shownTables(
  flow: Flow,
  member: Flow['nodes'][number],
  mode: 'all' | 'touched',
): TableInfo[] {
  const all = tablesOf(flow, [member]);
  return mode === 'all' ? all : all.filter((table) => table.touchedBy.length > 0);
}

/**
 * Var anrop från en lagringsnod som visas som tabeller utgår: från tabellen det senaste
 * anropet in i noden rörde, i flödets ordning, annars från nodens första tabell.
 */
function answeringTables(
  flow: Flow,
  expandedTables: ReadonlyMap<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();
  if (expandedTables.size === 0) return result;
  const edgeById = new Map(flow.edges.map((e) => [e.id, e]));
  const lastTable = new Map<string, string>();
  for (const step of allSteps(flow.steps)) {
    const edge = edgeById.get(step.edgeId);
    if (!edge) continue;
    const first = expandedTables.get(edge.from);
    if (first !== undefined && !result.has(edge.id)) {
      result.set(edge.id, tableNodeId(edge.from, lastTable.get(edge.from) ?? first));
    }
    const touched = edge.tables?.[0];
    if (expandedTables.has(edge.to) && touched) lastTable.set(edge.to, touched);
  }
  return result;
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
