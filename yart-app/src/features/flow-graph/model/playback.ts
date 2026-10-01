export type StepStatus = 'pending' | 'active' | 'done';

/** Det uppspelningen behöver veta om en graf. */
export interface StepInput {
  nodes: readonly { id: string }[];
  edges: readonly { id: string; from: string; to: string }[];
  steps: readonly { edgeId: string }[];
}

/** Status för varje kant och nod givet vilket steg som är aktivt. -1 betyder inget steg. */
export interface StepView {
  edges: Map<string, StepStatus>;
  nodes: Map<string, StepStatus>;
  activeEdgeId: string | null;
}

export function stepView(flow: StepInput, stepIndex: number): StepView {
  const edges = new Map<string, StepStatus>(flow.edges.map((e) => [e.id, 'pending']));
  const nodes = new Map<string, StepStatus>(flow.nodes.map((n) => [n.id, 'pending']));
  const edgeById = new Map(flow.edges.map((e) => [e.id, e]));

  const touch = (edgeId: string, status: StepStatus): void => {
    const edge = edgeById.get(edgeId);
    if (!edge) return;
    edges.set(edge.id, status);
    for (const nodeId of [edge.from, edge.to]) {
      if (status === 'active' || nodes.get(nodeId) !== 'active') nodes.set(nodeId, status);
    }
  };

  for (let i = 0; i < Math.min(stepIndex, flow.steps.length); i++) {
    const step = flow.steps[i];
    if (step) touch(step.edgeId, 'done');
  }
  const active = stepIndex >= 0 ? flow.steps[stepIndex] : undefined;
  if (active) touch(active.edgeId, 'active');

  return { edges, nodes, activeEdgeId: active?.edgeId ?? null };
}

export function clampStep(index: number, stepCount: number): number {
  if (stepCount === 0) return -1;
  return Math.max(0, Math.min(index, stepCount - 1));
}
