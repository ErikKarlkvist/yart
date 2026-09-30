import { type FlowChange, type ReviewFinding } from '@/common/model/review';

export type FlowHighlight = FlowChange | 'problem' | 'warning';

/** A real review issue takes precedence over a change marker. */
export function edgeHighlight(
  change: FlowChange | undefined,
  findings: readonly ReviewFinding[],
): FlowHighlight | undefined {
  if (findings.some((finding) => finding.severity === 'error')) return 'problem';
  if (findings.some((finding) => finding.severity === 'warning')) return 'warning';
  return change;
}

/** Several calls can share one drawn line; show the most urgent annotation. */
export function combinedHighlight(
  highlights: readonly (FlowHighlight | undefined)[],
): FlowHighlight | undefined {
  for (const kind of ['problem', 'warning', 'added', 'changed', 'removed'] as const) {
    if (highlights.includes(kind)) return kind;
  }
  return undefined;
}
