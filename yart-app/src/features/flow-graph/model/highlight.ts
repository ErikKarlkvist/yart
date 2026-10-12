import { type FlowChange, type ReviewFinding } from '@/common/model/review';
import { type FlowEdge } from '@/common/model/flow';

export type FlowHighlight = FlowChange | 'problem' | 'warning';

/** Ett problem på anropet eller från en review går före ändringsmarkeringen. */
export function edgeHighlight(
  change: FlowChange | undefined,
  findings: readonly ReviewFinding[],
  highlight?: FlowEdge['highlight'],
): FlowHighlight | undefined {
  if (highlight === 'problem' || findings.some((finding) => finding.severity === 'error'))
    return 'problem';
  if (findings.some((finding) => finding.severity === 'warning')) return 'warning';
  return change ?? highlight;
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
