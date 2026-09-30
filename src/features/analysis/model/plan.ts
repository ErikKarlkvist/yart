import { type Flow, type FlowEdge, type FlowNode, type SourceRef } from '@/common/model/flow';
import { findingLocation, type ReviewFinding, sortFindings } from '@/common/model/review';
import {
  type SavedDocumentAnalysis,
  type SavedFlowAnalysis,
  type SavedReviewAnalysis,
} from './analysis';

/**
 * Text för en AI-agent, byggd ur det dokumentet och reviewn bär i bakgrunden:
 * den dolda planen, fyndens fix-instruktioner och flödenas noder, anrop och
 * källor. Människan ser den korta texten, agenten får allt det här.
 */

/** Visar kopieringsknappen när dokumentet föreslår en ändring. */
export function hasImplementationPlan(
  document: SavedDocumentAnalysis,
  flows: readonly SavedFlowAnalysis[],
): boolean {
  if (document.document.plan !== undefined) return true;
  return linkedFlows(document.document.flows, flows).some(({ flow }) => proposed(flow).length > 0);
}

export function buildImplementationPlan(
  document: SavedDocumentAnalysis,
  flows: readonly SavedFlowAnalysis[],
): string {
  const { title, summary, content, plan } = document.document;
  const sections = [
    `# Implementation plan: ${title}`,
    summary,
    'Implement this in the current repository. Work through the plan in order, keep the change focused, and verify each step before moving on. Ask if something in the plan contradicts the code.',
  ];
  if (plan) sections.push(`## Plan\n\n${plan.trim()}`);
  sections.push(`## Background\n\n${content.trim()}`);
  const linked = linkedFlows(document.document.flows, flows);
  if (linked.length > 0)
    sections.push(`## Flows\n\n${linked.map((flow) => describeFlow(flow)).join('\n\n')}`);
  return `${sections.join('\n\n')}\n`;
}

export function buildReviewFixPlan(
  review: SavedReviewAnalysis,
  selected: readonly ReviewFinding[],
  flows: readonly SavedFlowAnalysis[],
): string {
  const { title, baseLabel, headLabel, baseCommit, headCommit } = review.review;
  const commits = [headCommit && `head ${headCommit}`, baseCommit && `base ${baseCommit}`]
    .filter(Boolean)
    .join(', ');
  const findings = sortFindings(selected).map((finding, i) => {
    const flow = flows.find((f) => f.name === finding.flow);
    return describeFinding(finding, i + 1, flow);
  });
  return `${[
    `# Fix plan: ${title}`,
    `The change \`${headLabel}\` was reviewed against \`${baseLabel}\`${commits ? ` (${commits})` : ''}.`,
    `Fix the review findings below on \`${headLabel}\`. Handle them in order, keep each fix focused, and verify it before moving on. If a finding turns out to be wrong, say so instead of changing the code.`,
    ...findings,
  ].join('\n\n')}\n`;
}

function describeFinding(
  finding: ReviewFinding,
  index: number,
  flow: SavedFlowAnalysis | undefined,
): string {
  const lines = [`## ${index}. [${finding.severity}] ${finding.title}`];
  if (flow) lines.push(`- Flow: ${flow.flow.title} (saved as \`${flow.name}\`)`);
  const location = findingLocation(finding, flow?.flow, flow?.compare?.base);
  const edge = finding.edgeId !== undefined ? findEdge(flow, finding.edgeId) : undefined;
  if (edge && flow) lines.push(`- Call: ${describeEdge(edge, flow.flow, flow.compare?.base)}`);
  else if (location) lines.push(`- Where: ${location}`);
  if (finding.source) lines.push(`- Code: \`${sourceText(finding.source)}\``);
  lines.push(`- Problem: ${finding.description}`);
  if (finding.suggestion) lines.push(`- Suggested fix: ${finding.suggestion}`);
  if (finding.fix) lines.push('', finding.fix.trim());
  return lines.join('\n');
}

function describeFlow(analysis: SavedFlowAnalysis): string {
  const { flow, compare, name } = analysis;
  const lines = [`### ${flow.title} (saved as \`${name}\`)`, flow.summary];
  if (compare) lines.push(`Compared: \`${compare.headLabel}\` against \`${compare.baseLabel}\`.`);
  if (flow.trigger) {
    const start = flow.nodes.find((n) => n.id === flow.trigger?.nodeId);
    lines.push(
      `Starts when: ${flow.trigger.label} (${flow.trigger.kind})${start ? ` at ${start.label}` : ''}.`,
    );
  }
  lines.push(
    'Steps:',
    ...flow.steps.map((step, i) => {
      const edge = flow.edges.find((e) => e.id === step.edgeId);
      const detail = edge ? ` (${describeEdge(edge, flow)})` : '';
      return `${i + 1}. ${step.description}${detail}`;
    }),
  );
  const changes = proposed(flow);
  if (changes.length > 0) lines.push('To add or change:', ...changes.map((c) => `- ${c}`));
  return lines.join('\n');
}

/** Noder och anrop planen lägger till eller ändrar, med källa när koden finns. */
function proposed(flow: Flow): string[] {
  const nodes = flow.nodes
    .filter((node) => node.highlight !== undefined)
    .map((node) => `[${node.highlight ?? ''}] ${describeNode(node)}`);
  const edges = flow.edges
    .filter((edge) => edge.highlight !== undefined)
    .map((edge) => `[${edge.highlight ?? ''}] call ${describeEdge(edge, flow)}`);
  return [...nodes, ...edges];
}

function describeNode(node: FlowNode): string {
  const parts = [`${node.label} (${node.role ?? node.kind})`];
  if (node.description) parts.push(node.description);
  if (node.source) parts.push(`\`${sourceText(node.source)}\``);
  return parts.join(' — ');
}

function describeEdge(edge: FlowEdge, flow: Flow, base?: Flow): string {
  const label = (id: string): string =>
    [...flow.nodes, ...(base?.nodes ?? [])].find((n) => n.id === id)?.label ?? id;
  const parts = [`${label(edge.from)} → ${label(edge.to)}: ${edge.label}`];
  if (edge.payload) parts.push(`sends ${edge.payload}`);
  if (edge.response) parts.push(`returns ${edge.response}`);
  if (edge.source) parts.push(`\`${sourceText(edge.source)}\``);
  return parts.join(', ');
}

function findEdge(flow: SavedFlowAnalysis | undefined, id: string): FlowEdge | undefined {
  return [...(flow?.flow.edges ?? []), ...(flow?.compare?.base.edges ?? [])].find(
    (e) => e.id === id,
  );
}

function linkedFlows(
  names: readonly string[],
  flows: readonly SavedFlowAnalysis[],
): SavedFlowAnalysis[] {
  return names.flatMap((name) => flows.filter((f) => f.name === name));
}

function sourceText(source: SourceRef): string {
  return source.endLine
    ? `${source.file}:${source.line}-${source.endLine}`
    : `${source.file}:${source.line}`;
}
