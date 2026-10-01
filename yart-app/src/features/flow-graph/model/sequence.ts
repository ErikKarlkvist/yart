import {
  type Flow,
  type FlowEdge,
  type FlowStep,
  type FlowStepEntry,
  type FlowTrigger,
  isAlt,
} from '@/common/model/flow';
import {
  allSteps,
  altKey,
  type AltChoices,
  resolveSteps,
  selectedBranch,
} from '@/common/model/steps';
import { buildModel, type GraphNode, type GraphView, type ReviewAnnotations } from './graph';

/**
 * Flödet som sekvensdiagram: en livlinje per deltagare i den ordning flödet
 * når dem, och ett meddelande per steg uppifrån och ned. Anrop inom en
 * deltagare, som mellan två noder i ett hopslaget system, ritas som en ögla
 * på livlinjen. Alternativ ritas som alt-block med alla grenar; de som inte
 * spelas tonas ned. Allt här är koordinater, komponenten ritar bara ut dem.
 */

interface SequenceParticipant {
  node: GraphNode;
  /** Livlinjens x */
  x: number;
  width: number;
}

/** Systemets namn ovanför dess noder när systemet är utfällt. */
interface SequenceBand {
  systemId: string;
  kind: GraphNode['kind'];
  label: string;
  x: number;
  width: number;
}

export interface SequenceMessage {
  /** Unikt per rad: ett steg kan bara stå på ett ställe, en borttagen kant en gång */
  id: string;
  edge: FlowEdge;
  /** Steget raden spelar; null för ett anrop som tagits bort i en review */
  step: FlowStep | null;
  from: string;
  to: string;
  x1: number;
  x2: number;
  y: number;
  /** Anrop inom samma deltagare, ritas som en ögla */
  self: boolean;
  /** Går tillbaka till en deltagare som anropat hit tidigare: ritas streckad */
  isReturn: boolean;
  /** Index bland de spelade stegen, null när raden ligger i en gren som inte spelas */
  played: number | null;
  /** Borttaget anrop i en review, ritas som spöke och spelas aldrig */
  removed: boolean;
}

interface SequenceBranch {
  index: number;
  label: string;
  /** Överkanten på grenens rubrikrad */
  y: number;
  selected: boolean;
  /** Grenen spelas: den är vald och alternativet självt ligger på den spelade vägen */
  played: boolean;
  empty: boolean;
}

interface SequenceFragment {
  key: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Alternativet ligger på den spelade vägen */
  played: boolean;
  branches: SequenceBranch[];
}

export interface Sequence {
  participants: SequenceParticipant[];
  bands: SequenceBand[];
  messages: SequenceMessage[];
  fragments: SequenceFragment[];
  /** Stegen som spelas, i ordning */
  steps: FlowStep[];
  trigger: (FlowTrigger & { x: number; y: number; startX: number }) | null;
  width: number;
  height: number;
  /** Höjden på rubriken med deltagarna, livlinjerna börjar under den */
  headerHeight: number;
  /** Alla deltagare står i samma höjd och är lika höga, oavsett nivå */
  boxTop: number;
  boxHeight: number;
}

/** Ett borttaget anrop i en review och steget före det i base. */
export interface RemovedCalls {
  /** Base-flödets spelade steg */
  baseSteps: readonly FlowStep[];
  removedEdgeIds: ReadonlySet<string>;
}

export const SEQUENCE = {
  bandHeight: 24,
  boxHeight: { node: 54, system: 64, table: 54 },
  headerGap: 22,
  margin: 32,
  triggerGutter: 56,
  triggerRow: 44,
  messageRow: 46,
  selfRow: 60,
  selfWidth: 30,
  selfHeight: 18,
  altHeader: 28,
  branchHeader: 24,
  emptyBranch: 14,
  altPadding: 14,
  altBottom: 10,
  columnGap: 44,
} as const;

/** Ungefärlig bredd på mono-text, räcker för att ge etiketterna plats. */
const MONO_10 = 6.1;
const MONO_13 = 7.9;
const MAX_LABEL = 300;

export function buildSequence(
  flow: Flow,
  view: GraphView,
  annotations: ReviewAnnotations | undefined,
  choices: AltChoices,
  removed: RemovedCalls | null = null,
): Sequence {
  const model = buildModel(flow, view, annotations, { choices, tables: false });
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(model.edges.map((e) => [e.id, e]));
  const steps = resolveSteps(flow.steps, choices);
  const playedIndex = new Map(steps.map((step, i) => [step, i]));
  const ghostsAfter = removed
    ? placeRemoved(flow.steps, removed, edgeById)
    : new Map<string | null, FlowEdge[]>();

  // Raderna i ordning, utan koordinater ännu
  type Row =
    | { kind: 'message'; edge: FlowEdge; step: FlowStep | null; played: boolean; removed: boolean }
    | { kind: 'altStart'; key: string; label: string; played: boolean }
    | {
        kind: 'branch';
        key: string;
        index: number;
        label: string;
        selected: boolean;
        played: boolean;
        empty: boolean;
      }
    | { kind: 'altEnd'; key: string };
  const rows: Row[] = [];
  const pushGhosts = (after: string | null): void => {
    for (const edge of ghostsAfter.get(after) ?? []) {
      rows.push({ kind: 'message', edge, step: null, played: false, removed: true });
    }
    ghostsAfter.delete(after);
  };
  const walk = (
    entries: readonly FlowStepEntry[],
    parent: { key: string; branch: number } | null,
    played: boolean,
  ): void => {
    entries.forEach((entry, index) => {
      if (!isAlt(entry)) {
        const edge = edgeById.get(entry.edgeId);
        if (!edge) return;
        rows.push({ kind: 'message', edge, step: entry, played, removed: false });
        pushGhosts(edge.id);
        return;
      }
      const key = altKey(parent, index);
      const selected = selectedBranch(entry, key, choices);
      rows.push({ kind: 'altStart', key, label: entry.alt, played });
      entry.branches.forEach((branch, b) => {
        rows.push({
          kind: 'branch',
          key,
          index: b,
          label: branch.label,
          selected: b === selected,
          played: played && b === selected,
          empty: branch.steps.length === 0,
        });
        walk(branch.steps, { key, branch: b }, played && b === selected);
      });
      rows.push({ kind: 'altEnd', key });
    });
  };
  pushGhosts(null);
  walk(flow.steps, null, true);
  for (const after of [...ghostsAfter.keys()]) pushGhosts(after);

  // Deltagarna i den ordning flödet når dem, startpunkten först och ett systems noder ihop
  const trigger = model.nodes.find((n) => n.trigger !== undefined);
  const seen: string[] = trigger ? [trigger.id] : [];
  for (const row of rows) {
    if (row.kind !== 'message') continue;
    for (const id of [row.edge.from, row.edge.to]) {
      if (!seen.includes(id) && nodeById.has(id)) seen.push(id);
    }
  }
  const systemOrder = [...new Set(seen.map((id) => nodeById.get(id)?.systemId ?? id))];
  const ordered = systemOrder.flatMap((systemId) =>
    seen.flatMap((id) => {
      const node = nodeById.get(id);
      return node?.systemId === systemId ? [node] : [];
    }),
  );
  const column = new Map(ordered.map((node, i) => [node.id, i]));
  const widths = ordered.map((node) =>
    clamp(Math.ceil(node.label.length * MONO_13 + 40), 140, node.level === 'system' ? 240 : 220),
  );

  // Avståndet mellan livlinjerna: lådorna får inte gå ihop och etiketterna ska få plats
  const gaps = ordered.slice(1).map((_, i) => {
    const left = widths[i] ?? 0;
    const right = widths[i + 1] ?? 0;
    return (left + right) / 2 + SEQUENCE.columnGap;
  });
  let rightOverhang = 0;
  const spans: { from: number; to: number; need: number }[] = [];
  for (const row of rows) {
    if (row.kind !== 'message') continue;
    const a = column.get(row.edge.from);
    const b = column.get(row.edge.to);
    if (a === undefined || b === undefined) continue;
    const label = labelWidth(row.edge.label);
    if (a === b) {
      const need = SEQUENCE.selfWidth + 12 + label + 16;
      if (a < gaps.length) gaps[a] = Math.max(gaps[a] ?? 0, need);
      else rightOverhang = Math.max(rightOverhang, need - (widths[a] ?? 0) / 2);
      continue;
    }
    spans.push({ from: Math.min(a, b), to: Math.max(a, b), need: label + 40 });
  }
  spans.sort((p, q) => p.to - p.from - (q.to - q.from));
  for (const span of spans) {
    const count = span.to - span.from;
    const have = gaps.slice(span.from, span.to).reduce((sum, gap) => sum + gap, 0);
    if (have >= span.need) continue;
    const extra = (span.need - have) / count;
    for (let i = span.from; i < span.to; i++) gaps[i] = (gaps[i] ?? 0) + extra;
  }

  const left = SEQUENCE.margin + (trigger ? SEQUENCE.triggerGutter : 0);
  const xs: number[] = [];
  ordered.forEach((_, i) => {
    xs.push(i === 0 ? left + (widths[0] ?? 0) / 2 : (xs[i - 1] ?? 0) + (gaps[i - 1] ?? 0));
  });
  const participants = ordered.map((node, i) => ({
    node,
    x: xs[i] ?? 0,
    width: widths[i] ?? 0,
  }));
  const xOf = (id: string): number => xs[column.get(id) ?? 0] ?? 0;

  const bands: SequenceBand[] = [];
  for (const group of model.groups) {
    const members = participants.filter(
      (p) => p.node.systemId === group.id && p.node.level !== 'system',
    );
    const first = members[0];
    const last = members[members.length - 1];
    if (!first || !last) continue;
    const x = first.x - first.width / 2;
    bands.push({
      systemId: group.id,
      kind: group.kind,
      label: group.label,
      x,
      width: last.x + last.width / 2 - x,
    });
  }
  const boxHeight = Math.max(0, ...participants.map((p) => SEQUENCE.boxHeight[p.node.level]));
  const boxTop = (bands.length > 0 ? SEQUENCE.bandHeight : 0) + 8;
  const headerHeight = boxTop + boxHeight + 16;

  // Raderna uppifrån och ned. Alt-blockens bredd räknas från det de rymmer.
  let y = headerHeight + SEQUENCE.headerGap;
  let triggerInfo: Sequence['trigger'] = null;
  if (trigger?.trigger) {
    triggerInfo = {
      ...trigger.trigger,
      x: xOf(trigger.id),
      y: y + SEQUENCE.triggerRow / 2,
      startX: SEQUENCE.margin,
    };
    y += SEQUENCE.triggerRow;
  }
  const messages: SequenceMessage[] = [];
  const fragments: SequenceFragment[] = [];
  const seenPairs = new Set<string>();
  interface Open {
    fragment: SequenceFragment;
    minX: number;
    maxX: number;
    depth: number;
  }
  const open: Open[] = [];
  const extend = (minX: number, maxX: number): void => {
    const current = open[open.length - 1];
    if (!current) return;
    current.minX = Math.min(current.minX, minX);
    current.maxX = Math.max(current.maxX, maxX);
  };
  rows.forEach((row, i) => {
    switch (row.kind) {
      case 'message': {
        const from = row.edge.from;
        const to = row.edge.to;
        const self = from === to;
        const x1 = xOf(from);
        const x2 = xOf(to);
        const isReturn = !self && seenPairs.has(`${to}>${from}`);
        if (!self) seenPairs.add(`${from}>${to}`);
        const top = y + (self ? SEQUENCE.messageRow - 16 : SEQUENCE.messageRow - 12);
        messages.push({
          id: row.step ? `step:${i}` : `removed:${row.edge.id}`,
          edge: row.edge,
          step: row.step,
          from,
          to,
          x1,
          x2,
          y: top,
          self,
          isReturn,
          played: row.played && row.step ? (playedIndex.get(row.step) ?? null) : null,
          removed: row.removed,
        });
        y += self ? SEQUENCE.selfRow : SEQUENCE.messageRow;
        if (self) extend(x1, x1 + SEQUENCE.selfWidth + 12 + labelWidth(row.edge.label));
        else extend(Math.min(x1, x2), Math.max(x1, x2));
        break;
      }
      case 'altStart': {
        const fragment: SequenceFragment = {
          key: row.key,
          label: row.label,
          x: 0,
          y,
          width: 0,
          height: 0,
          played: row.played,
          branches: [],
        };
        fragments.push(fragment);
        open.push({ fragment, minX: Infinity, maxX: -Infinity, depth: open.length });
        y += SEQUENCE.altHeader;
        break;
      }
      case 'branch': {
        const current = open[open.length - 1];
        current?.fragment.branches.push({
          index: row.index,
          label: row.label,
          y,
          selected: row.selected,
          played: row.played,
          empty: row.empty,
        });
        y += SEQUENCE.branchHeader + (row.empty ? SEQUENCE.emptyBranch : 0);
        break;
      }
      case 'altEnd': {
        const current = open.pop();
        if (!current) break;
        y += SEQUENCE.altBottom;
        const { fragment } = current;
        // Ett block utan anrop ritas runt den första livlinjen
        const minX = Number.isFinite(current.minX) ? current.minX : (xs[0] ?? 0);
        const maxX = Number.isFinite(current.maxX) ? current.maxX : (xs[0] ?? 0);
        const titleWidth = labelWidth(fragment.label) + 60;
        const branchWidth = Math.max(...fragment.branches.map((b) => labelWidth(b.label) + 40));
        fragment.x = minX - SEQUENCE.altPadding * 2;
        fragment.width = Math.max(maxX - minX + SEQUENCE.altPadding * 4, titleWidth, branchWidth);
        fragment.height = y - fragment.y;
        y += 8;
        extend(fragment.x, fragment.x + fragment.width);
        break;
      }
    }
  });
  const height = y + SEQUENCE.margin;

  // Ett alt-block får inte gå utanför vänsterkanten
  const minX = Math.min(
    SEQUENCE.margin,
    ...fragments.map((f) => f.x),
    ...participants.map((p) => p.x - p.width / 2),
  );
  const shift = SEQUENCE.margin - minX;
  if (shift > 0) {
    for (const p of participants) p.x += shift;
    for (const b of bands) b.x += shift;
    for (const m of messages) {
      m.x1 += shift;
      m.x2 += shift;
    }
    for (const f of fragments) f.x += shift;
    if (triggerInfo) triggerInfo.x += shift;
  }
  const lastParticipant = participants[participants.length - 1];
  const width =
    Math.max(
      (lastParticipant ? lastParticipant.x + lastParticipant.width / 2 : 0) + rightOverhang,
      ...fragments.map((f) => f.x + f.width),
      ...messages
        .filter((m) => m.self)
        .map((m) => m.x1 + SEQUENCE.selfWidth + 12 + labelWidth(m.edge.label)),
    ) + SEQUENCE.margin;

  return {
    participants,
    bands,
    messages,
    fragments,
    steps,
    trigger: triggerInfo,
    width,
    height,
    headerHeight,
    boxTop,
    boxHeight,
  };
}

/**
 * Var borttagna anrop ska stå: efter det senaste steget före dem i base som
 * också finns i head, eller först om inget sådant finns.
 */
function placeRemoved(
  entries: readonly FlowStepEntry[],
  removed: RemovedCalls,
  edgeById: ReadonlyMap<string, FlowEdge>,
): Map<string | null, FlowEdge[]> {
  const headEdges = new Set(allSteps(entries).map((step) => step.edgeId));
  const result = new Map<string | null, FlowEdge[]>();
  let anchor: string | null = null;
  const placed = new Set<string>();
  for (const step of removed.baseSteps) {
    if (headEdges.has(step.edgeId)) {
      anchor = step.edgeId;
      continue;
    }
    const edge = edgeById.get(step.edgeId);
    if (!edge || !removed.removedEdgeIds.has(step.edgeId) || placed.has(edge.id)) continue;
    placed.add(edge.id);
    result.set(anchor, [...(result.get(anchor) ?? []), edge]);
  }
  return result;
}

function labelWidth(label: string): number {
  return Math.min(MAX_LABEL, Math.ceil((label.length + 3) * MONO_10 + 18));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
