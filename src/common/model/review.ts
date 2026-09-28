import { z } from 'zod';
import { type Flow, type FlowEdge, type FlowNode, flowSchema, sourceRefSchema } from './flow';
import { t } from './i18n';

/**
 * En review jämför flödet före en ändring (base) med flödet efter (head)
 * och pekar ut var problem kan finnas. Head-flödet är analysens vanliga
 * `flow`, så allt som fungerar på flöden fungerar på reviewer.
 */

const findingSeveritySchema = z.enum(['info', 'warning', 'error']);

const reviewFindingSchema = z.object({
  id: z.string().min(1),
  severity: findingSeveritySchema,
  /** Kort, t.ex. "Cache is no longer invalidated" */
  title: z.string().min(1),
  /** Vad som händer och varför det spelar roll */
  description: z.string().min(1),
  /** Vad som borde göras i stället */
  suggestion: z.string().optional(),
  /** Noden i head, eller i base om den tagits bort, som fyndet gäller */
  nodeId: z.string().min(1).optional(),
  /** Kanten i head, eller i base om den tagits bort, som fyndet gäller */
  edgeId: z.string().min(1).optional(),
  source: sourceRefSchema.optional(),
});

export const reviewSchema = z
  .object({
    /** Vad som jämförs, t.ex. branch eller commit */
    baseLabel: z.string().min(1),
    headLabel: z.string().min(1),
    /** Flödet före ändringen. Flödet efter är analysens `flow`. */
    base: flowSchema,
    /** Commiten baseLabel pekade på vid importen, om den fanns i repot */
    baseCommit: z.string().optional(),
    findings: z.array(reviewFindingSchema),
  })
  .superRefine((review, ctx) => {
    const ids = new Set<string>();
    review.findings.forEach((finding, i) => {
      if (ids.has(finding.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', i, 'id'],
          message: t('validation.duplicateFinding', { id: finding.id }),
        });
      }
      ids.add(finding.id);
    });
  });

/**
 * Filen agenten skriver till `.reverik/reviews/`: båda flödena och fynden.
 * Importeras som en analys med `flow` = head och `review` = resten.
 */
const reviewDocumentSchema = z.object({
  baseLabel: z.string().min(1),
  headLabel: z.string().min(1),
  base: flowSchema,
  head: flowSchema,
  findings: z.array(reviewFindingSchema),
});

export type ReviewValidation =
  { ok: true; flow: Flow; review: Review } | { ok: false; errors: string[] };

/** Validerar en reviewfil och delar upp den i analysens flöde och review. */
export function validateReviewDocument(input: unknown): ReviewValidation {
  const parsed = reviewDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.map(String).join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }
  const { head, ...rest } = parsed.data;
  const review = reviewSchema.safeParse(rest);
  if (!review.success) {
    return {
      ok: false,
      errors: review.error.issues.map((issue) => issue.message),
    };
  }
  return { ok: true, flow: head, review: review.data };
}

export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type Review = z.infer<typeof reviewSchema>;

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
 * Flödet som ritas i en review: head plus det som tagits bort ur base, så
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

/**
 * Fynden som text att kopiera eller skicka till agenten: en numrerad lista
 * med allvarlighet, titel, var i flödet, fil och rad, beskrivning och förslag.
 */
export function formatFindings(findings: readonly ReviewFinding[], flow: Flow, base: Flow): string {
  const label = (finding: ReviewFinding): string | null => {
    if (finding.nodeId) {
      const id = finding.nodeId;
      return [...flow.nodes, ...base.nodes].find((n) => n.id === id)?.label ?? id;
    }
    if (finding.edgeId) {
      const id = finding.edgeId;
      return [...flow.edges, ...base.edges].find((e) => e.id === id)?.label ?? id;
    }
    return null;
  };
  return sortFindings(findings)
    .map((finding, i) => {
      const where = [
        label(finding),
        finding.source && `${finding.source.file}:${finding.source.line}`,
      ]
        .filter(Boolean)
        .join(', ');
      const lines = [
        `${i + 1}. [${finding.severity}] ${finding.title}${where ? ` (${where})` : ''}`,
        `   ${finding.description}`,
      ];
      if (finding.suggestion) lines.push(`   Suggestion: ${finding.suggestion}`);
      return lines.join('\n');
    })
    .join('\n');
}
