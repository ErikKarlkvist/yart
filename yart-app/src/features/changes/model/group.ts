import { type Flow, type SourceRef } from '@/common/model/flow';
import { resolveSteps } from '@/common/model/steps';
import { type Chunk, type FileDiff, newRange, oldRange } from './diff';

/**
 * Diffen i flödesordning: varje flöde i reviewn får en grupp med de chunks
 * som rör dess noder och anrop, sorterade som stegen spelas. Det inget flöde
 * rör hamnar sist, i mappordning. En chunk som flera flöden rör visas i det
 * första och nämner de andra.
 */

/** Ett flöde i reviewn, med flödet före ändringen när det finns. */
export interface ReviewedFlow {
  name: string;
  title: string;
  flow: Flow;
  base?: Flow | undefined;
}

/** Var i flödet en chunk hör hemma. Index 0 är startpunkten, sedan stegen från 1. */
interface FlowPlace {
  index: number;
  label: string;
  /** Stegets beskrivning: vad som händer här, som förklaring till ändringen */
  description?: string | undefined;
  /** Hänvisningens plats i flödets ordning, så anropet kommer före noden det når */
  order: number;
}

export interface PlacedChunk {
  chunk: Chunk;
  file: FileDiff;
  /** Null i gruppen för det inget flöde rör */
  place: FlowPlace | null;
  /** Titlar på andra flöden i reviewn som också rör chunken */
  alsoIn: string[];
}

export interface ChangeGroup {
  key: string;
  /** Null för gruppen med övriga ändringar */
  flow: ReviewedFlow | null;
  chunks: PlacedChunk[];
}

/** En källhänvisning med sin plats i flödet. Base-sidans hänvisningar matchas mot raderna i base. */
interface Anchor {
  ref: SourceRef;
  side: 'head' | 'base';
  place: FlowPlace;
}

type Step = Omit<FlowPlace, 'order'>;

export function groupChunks(
  files: readonly FileDiff[],
  flows: readonly ReviewedFlow[],
): ChangeGroup[] {
  const anchors = flows.map((flow) => flowAnchors(flow));
  const groups: ChangeGroup[] = flows.map((flow) => ({ key: flow.name, flow, chunks: [] }));
  const other: ChangeGroup = { key: '', flow: null, chunks: [] };

  for (const file of files) {
    for (const chunk of file.chunks) {
      const hits = flows.flatMap((flow, i) => {
        const place = bestPlace(anchors[i] ?? [], chunk);
        return place ? [{ flow, place }] : [];
      });
      const first = hits[0];
      if (!first) {
        other.chunks.push({ chunk, file, place: null, alsoIn: [] });
        continue;
      }
      const group = groups.find((g) => g.flow === first.flow);
      group?.chunks.push({
        chunk,
        file,
        place: first.place,
        alsoIn: hits.slice(1).map((hit) => hit.flow.title),
      });
    }
  }

  for (const group of groups) group.chunks.sort(byPlace);
  other.chunks.sort(byFile);
  return [...groups, ...(other.chunks.length > 0 ? [other] : [])];
}

/**
 * Hänvisningarna i ett flöde i uppspelningsordning: startnoden först, sedan
 * varje stegs anrop och noden det går till. Noder inga steg når och allt i
 * base kommer efter stegen, så borttagen kod ändå hittar sitt flöde.
 */
function flowAnchors(reviewed: ReviewedFlow): Anchor[] {
  const { flow, base } = reviewed;
  const anchors: Anchor[] = [];
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const edges = new Map(flow.edges.map((edge) => [edge.id, edge]));
  const seenNodes = new Set<string>();

  const add = (ref: SourceRef, side: Anchor['side'], step: Step): void => {
    anchors.push({ ref, side, place: { ...step, order: anchors.length } });
  };
  const addNode = (id: string, step: Step): void => {
    const node = nodes.get(id);
    if (!node || seenNodes.has(id)) return;
    seenNodes.add(id);
    if (node.source) add(node.source, 'head', step);
    for (const table of node.tables ?? []) {
      if (table.source) add(table.source, 'head', step);
    }
  };

  if (flow.trigger) addNode(flow.trigger.nodeId, { index: 0, label: flow.trigger.label });
  const steps = resolveSteps(flow.steps);
  steps.forEach((step, i) => {
    const edge = edges.get(step.edgeId);
    if (!edge) return;
    const place = { index: i + 1, label: edge.label, description: step.description };
    if (edge.source) add(edge.source, 'head', place);
    addNode(edge.to, place);
  });

  const after = steps.length + 1;
  for (const node of flow.nodes) {
    addNode(node.id, { index: after, label: node.label, description: node.description });
  }
  for (const edge of base?.edges ?? []) {
    if (edge.source && !edges.has(edge.id))
      add(edge.source, 'base', { index: after, label: edge.label });
  }
  for (const node of base?.nodes ?? []) {
    if (node.source && !nodes.has(node.id))
      add(node.source, 'base', { index: after, label: node.label });
  }
  return anchors;
}

/** Den tidigaste platsen i flödet vars kod chunken rör, null om ingen. */
function bestPlace(anchors: readonly Anchor[], chunk: Chunk): FlowPlace | null {
  let best: FlowPlace | null = null;
  for (const anchor of anchors) {
    if (anchor.ref.file !== chunk.file) continue;
    const range = anchor.side === 'head' ? newRange(chunk) : oldRange(chunk);
    const from = anchor.ref.line;
    const to = anchor.ref.endLine ?? anchor.ref.line;
    if (from > range.to || to < range.from) continue;
    if (!best || anchor.place.order < best.order) best = anchor.place;
  }
  return best;
}

function byPlace(a: PlacedChunk, b: PlacedChunk): number {
  return (a.place?.order ?? 0) - (b.place?.order ?? 0) || byFile(a, b);
}

function byFile(a: PlacedChunk, b: PlacedChunk): number {
  return a.chunk.file.localeCompare(b.chunk.file) || a.chunk.newStart - b.chunk.newStart;
}
