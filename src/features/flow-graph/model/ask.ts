import { type Flow, type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type GraphNode } from './graph';

/** Det användaren pekat ut i grafen för att fråga om. */
export type AskTarget = { kind: 'node'; node: GraphNode } | { kind: 'edge'; edge: FlowEdge };

export function askLabel(target: AskTarget): string {
  return target.kind === 'node' ? target.node.label : target.edge.label;
}

export function askSource(target: AskTarget): SourceRef | undefined {
  return target.kind === 'node' ? target.node.source : target.edge.source;
}

/**
 * Frågan som skickas till agenten, med det som behövs för att den ska förstå
 * vad som pekas ut: nod eller anrop, fil och rad, flödet och namnet det är
 * sparat under så den kan spara om det.
 */
export function buildAskPrompt(
  flow: Flow,
  target: AskTarget,
  question: string,
  flowName: string | undefined,
): string {
  const source = askSource(target);
  const shared = {
    source: source ? t('ask.source', { file: source.file, line: source.line }) : '',
    flow: flow.title,
    file: flowName ? t('ask.name', { name: flowName }) : '',
    question: question.trim(),
  };
  if (target.kind === 'node') return t('ask.nodePrompt', { ...shared, label: target.node.label });
  const label = (id: string): string => flow.nodes.find((n) => n.id === id)?.label ?? id;
  return t('ask.edgePrompt', {
    ...shared,
    label: target.edge.label,
    from: label(target.edge.from),
    to: label(target.edge.to),
  });
}
