import { z } from 'zod';
import { brandText } from './brand';
import { type Flow, type FlowEdge, type FlowNode, flowSchema, sourceRefSchema } from './flow';
import { t } from './i18n';
import { READABLE_TEXT } from './document';
import { analysisNameSchema } from './name';

/**
 * En review är ett dokument om en ändring: vad den gör, vilka flöden den rör
 * och fynden, som pekar på ett flöde och en nod eller ett anrop i det. Flödena
 * sparas för sig och bär jämförelsen mot base, så allt som fungerar på flöden
 * fungerar på det som reviewas.
 */

/** Det ett flöde bär när det beskriver en ändring: samma flöde före ändringen. */
export const flowCompareSchema = z
  .object({
    baseLabel: z
      .string()
      .min(1)
      .describe('What the change is compared against: a real git reference such as "main"'),
    headLabel: z
      .string()
      .min(1)
      .describe(
        brandText(
          'The change itself: a real git reference such as "feature/todo-lists" or a commit. {appName} checks the flow against it when it resolves in the repository.',
        ),
      ),
    base: flowSchema.describe(
      brandText(
        'The same flow as it works on base, before the change. Keep the same node and edge ids as in the flow for things that are the same, so {appName} can show what was added, removed and changed.',
      ),
    ),
    /** Commiten baseLabel pekade på vid importen, om den fanns i repot */
    baseCommit: z.string().optional(),
  })
  .describe(
    brandText('Include when the flow describes a change, so {appName} can show what changed'),
  );

const findingSeveritySchema = z.enum(['info', 'warning', 'error']);

const reviewFindingSchema = z
  .object({
    id: z.string().min(1).describe('Unique within findings'),
    severity: findingSeveritySchema,
    title: z.string().min(1).describe('Short, e.g. "The cached list is no longer invalidated"'),
    description: z
      .string()
      .min(1)
      .describe('What happens and why it matters, one or two short sentences for a person'),
    suggestion: z.string().optional().describe('What to do instead, one short sentence'),
    fix: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Detailed fix instructions for an AI coding agent: which files and functions to change, how, and how to verify it. Not shown to the user; included when they copy or send a fix plan.',
      ),
    flow: analysisNameSchema
      .optional()
      .describe('The saved flow the finding is about, one of the names in flows'),
    nodeId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'The node in that flow the finding is about, or in its base if the node was removed',
      ),
    edgeId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'The call in that flow the finding is about, or in its base if the call was removed',
      ),
    source: sourceRefSchema.optional().describe('File and line on head'),
  })
  .describe('Something that looks wrong or risky in the change');

export const reviewSchema = z
  .object({
    title: z.string().min(1).describe('Short, e.g. "Todo lists"'),
    summary: z
      .string()
      .min(1)
      .max(500)
      .describe('One or two sentences: what the change does and the verdict'),
    content: z
      .string()
      .min(1)
      .describe(
        `${READABLE_TEXT} What the change does and how it affects the data flows. Do not repeat the findings, they are listed below the text.`,
      ),
    baseLabel: z
      .string()
      .min(1)
      .describe('What the change is compared against: a real git reference such as "main"'),
    headLabel: z
      .string()
      .min(1)
      .describe('The change itself: a real git reference such as "feature/todo-lists" or a commit'),
    /** Commiterna etiketterna pekade på vid importen, om de fanns i repot */
    baseCommit: z.string().optional(),
    headCommit: z.string().optional(),
    flows: z
      .array(analysisNameSchema)
      .default([])
      .describe(
        'Names of the saved flows the change touches, each saved with save_flow and a compare. Findings point into them.',
      ),
    findings: z
      .array(reviewFindingSchema)
      .describe('What looks wrong or risky. May be a single info finding if nothing is wrong.'),
  })
  .superRefine((review, ctx) => {
    const ids = new Set<string>();
    const flows = new Set(review.flows);
    review.findings.forEach((finding, i) => {
      if (ids.has(finding.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', i, 'id'],
          message: t('validation.duplicateFinding', { id: finding.id }),
        });
      }
      ids.add(finding.id);
      if (finding.flow !== undefined && !flows.has(finding.flow)) {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', i, 'flow'],
          message: t('validation.unknownFlowInFinding', { id: finding.id, flow: finding.flow }),
        });
      }
      if (
        finding.flow === undefined &&
        (finding.nodeId !== undefined || finding.edgeId !== undefined)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', i, 'flow'],
          message: t('validation.findingNeedsFlow', { id: finding.id }),
        });
      }
    });
  });

export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type FlowCompare = z.infer<typeof flowCompareSchema>;

export type ReviewValidation = { ok: true; review: Review } | { ok: false; errors: string[] };

export function validateReview(input: unknown): ReviewValidation {
  const parsed = reviewSchema.safeParse(input);
  if (parsed.success) return { ok: true, review: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

/**
 * Kontrollerar att fyndens noder och kanter finns i flödet de pekar på, i
 * head eller i base. Flödena slås upp per namn; saknas ett flöde är det ett
 * fel i sig, agenten ska spara det först.
 */
export function checkFindingTargets(
  review: Review,
  lookup: (name: string) => { flow: Flow; base?: Flow } | null,
): string[] {
  const errors: string[] = [];
  const flows = new Map<string, { flow: Flow; base?: Flow } | null>();
  for (const name of review.flows) {
    const found = lookup(name);
    flows.set(name, found);
    if (!found) errors.push(t('validation.flowNotSaved', { flow: name }));
  }
  for (const finding of review.findings) {
    if (finding.flow === undefined) continue;
    const found = flows.get(finding.flow);
    if (!found) continue;
    const nodes = [...found.flow.nodes, ...(found.base?.nodes ?? [])];
    const edges = [...found.flow.edges, ...(found.base?.edges ?? [])];
    if (finding.nodeId !== undefined && !nodes.some((n) => n.id === finding.nodeId)) {
      errors.push(
        t('validation.unknownFindingNode', {
          id: finding.id,
          node: finding.nodeId,
          flow: finding.flow,
        }),
      );
    }
    if (finding.edgeId !== undefined && !edges.some((e) => e.id === finding.edgeId)) {
      errors.push(
        t('validation.unknownFindingEdge', {
          id: finding.id,
          edge: finding.edgeId,
          flow: finding.flow,
        }),
      );
    }
  }
  return errors;
}

const SEVERITY_ORDER: Readonly<Record<FindingSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Allvarligaste först. */
export function sortFindings(findings: readonly ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function worstSeverity(findings: readonly ReviewFinding[]): FindingSeverity | null {
  return sortFindings(findings)[0]?.severity ?? null;
}

export type FlowChange = 'added' | 'removed' | 'changed';

export interface FlowDiff {
  /** Nod-id till ändring. Oförändrade noder saknas. */
  nodes: Map<string, FlowChange>;
  edges: Map<string, FlowChange>;
}

/** Jämför noder och kanter på id. Ändrad betyder att något synligt skiljer sig. */
export function diffFlows(base: Flow, head: Flow): FlowDiff {
  return {
    nodes: diffById(base.nodes, head.nodes, nodeFingerprint),
    edges: diffById(base.edges, head.edges, edgeFingerprint),
  };
}

function diffById<T extends { id: string }>(
  base: readonly T[],
  head: readonly T[],
  fingerprint: (item: T) => string,
): Map<string, FlowChange> {
  const changes = new Map<string, FlowChange>();
  const baseById = new Map(base.map((item) => [item.id, item]));
  const headIds = new Set(head.map((item) => item.id));
  for (const item of head) {
    const before = baseById.get(item.id);
    if (!before) changes.set(item.id, 'added');
    else if (fingerprint(before) !== fingerprint(item)) changes.set(item.id, 'changed');
  }
  for (const item of base) {
    if (!headIds.has(item.id)) changes.set(item.id, 'removed');
  }
  return changes;
}

function nodeFingerprint(node: FlowNode): string {
  return JSON.stringify([
    node.kind,
    node.system,
    node.label,
    node.role,
    node.description,
    node.source,
    node.tables,
  ]);
}

function edgeFingerprint(edge: FlowEdge): string {
  return JSON.stringify([
    edge.from,
    edge.to,
    edge.label,
    edge.payload,
    edge.response,
    edge.source,
    edge.tables,
  ]);
}

/**
 * Flödet som ritas i en jämförelse: head plus det som tagits bort ur base, så
 * att borttagna noder och anrop kan visas som spöken. Stegen är heads, så
 * det borttagna spelas inte upp.
 */
export function mergeForReview(head: Flow, base: Flow, diff: FlowDiff): Flow {
  const removedNodes = base.nodes.filter((n) => diff.nodes.get(n.id) === 'removed');
  const removedEdges = base.edges.filter((e) => diff.edges.get(e.id) === 'removed');
  const systemIds = new Set(head.systems.map((s) => s.id));
  const removedSystems = base.systems.filter(
    (s) => !systemIds.has(s.id) && removedNodes.some((n) => n.system === s.id),
  );
  return {
    ...head,
    systems: [...head.systems, ...removedSystems],
    nodes: [...head.nodes, ...removedNodes],
    edges: [...head.edges, ...removedEdges],
  };
}

/** Etiketten på noden eller kanten ett fynd pekar på, i head eller base. */
export function findingLocation(
  finding: ReviewFinding,
  flow: Flow | undefined,
  base: Flow | undefined,
): string | null {
  if (finding.nodeId !== undefined) {
    const id = finding.nodeId;
    return [...(flow?.nodes ?? []), ...(base?.nodes ?? [])].find((n) => n.id === id)?.label ?? id;
  }
  if (finding.edgeId !== undefined) {
    const id = finding.edgeId;
    return [...(flow?.edges ?? []), ...(base?.edges ?? [])].find((e) => e.id === id)?.label ?? id;
  }
  return null;
}
