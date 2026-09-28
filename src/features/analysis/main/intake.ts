import { z } from 'zod';
import { headRef, resolveCommit } from '@/common/main/git';
import { type ReverikDocument, validateDocument } from '@/common/model/document';
import { type Flow, flowSchema, validateFlow } from '@/common/model/flow';
import {
  checkFindingTargets,
  type FlowCompare,
  flowCompareSchema,
  type Review,
  validateReview,
} from '@/common/model/review';
import { type AnalysisRef, type SavedAnalysis } from '../model/analysis';
import { type AnalysisStore, type NewAnalysis } from './store';
import { verifySources } from './verify';

/** Sorterna en leverans kan ha, samma som analysens kind. */
export type IntakeKind = 'flow' | 'review' | 'document';

/**
 * Det som levereras för ett flöde: flödet och, när det beskriver en ändring,
 * jämförelsen mot base. Ett flöde utan omslag tas också emot.
 */
const flowDeliverySchema = z.object({
  flow: flowSchema,
  compare: flowCompareSchema.optional(),
});

export type IntakeResult =
  | { type: 'imported'; analysis: SavedAnalysis }
  | { type: 'rejected'; errors: string[] }
  /** Samma innehåll finns redan sparat under namnet */
  | { type: 'unchanged'; analysis: SavedAnalysis };

type Parsed =
  | { ok: true; kind: 'flow'; flow: Flow; compare?: FlowCompare; ref: AnalysisRef | null }
  | { ok: true; kind: 'document'; document: ReverikDocument; ref: AnalysisRef | null }
  | { ok: true; kind: 'review'; review: Review; ref: AnalysisRef | null }
  | { ok: false; errors: string[] };

/**
 * Tar emot en analys oavsett väg in: validerar den mot schemat, kontrollerar
 * källhänvisningar mot repot och sparar den under sitt namn. Felen är skrivna
 * för att skickas tillbaka till agenten.
 */
export async function intakeAnalysis(
  store: AnalysisStore,
  repoPath: string,
  kind: IntakeKind,
  name: string,
  json: unknown,
): Promise<IntakeResult> {
  const parsed = await parseAndVerify(store, repoPath, json, kind);
  if (!parsed.ok) return { type: 'rejected', errors: parsed.errors };

  const existing = await store.get(repoPath, parsed.kind, name);
  if (existing && existing.ref?.commit === parsed.ref?.commit && sameContent(existing, parsed)) {
    return { type: 'unchanged', analysis: existing };
  }
  const shared = { name, ref: parsed.ref };
  const input: NewAnalysis =
    parsed.kind === 'document'
      ? { ...shared, kind: 'document', document: parsed.document }
      : parsed.kind === 'review'
        ? { ...shared, kind: 'review', review: parsed.review }
        : {
            ...shared,
            kind: 'flow',
            flow: parsed.flow,
            ...(parsed.compare ? { compare: parsed.compare } : {}),
          };
  return { type: 'imported', analysis: await store.upsert(repoPath, input) };
}

function sameContent(existing: SavedAnalysis, parsed: Parsed & { ok: true }): boolean {
  switch (parsed.kind) {
    case 'document':
      return (
        existing.kind === 'document' &&
        JSON.stringify(existing.document) === JSON.stringify(parsed.document)
      );
    case 'review':
      return (
        existing.kind === 'review' &&
        JSON.stringify(existing.review) === JSON.stringify(parsed.review)
      );
    case 'flow':
      return (
        existing.kind === 'flow' &&
        JSON.stringify(existing.flow) === JSON.stringify(parsed.flow) &&
        JSON.stringify(existing.compare) === JSON.stringify(parsed.compare)
      );
  }
}

/**
 * Ett flöde beskriver arbetsträdet och kontrolleras mot det. Ett flöde med
 * jämförelse kontrolleras mot branchen det säger sig beskriva om den finns i
 * repot och inte är utcheckad, annars mot arbetsträdet. Base beskriver en
 * annan branch och kontrolleras inte. En review måste peka på sparade flöden.
 */
async function parseAndVerify(
  store: AnalysisStore,
  repoPath: string,
  json: unknown,
  kind: IntakeKind,
): Promise<Parsed> {
  if (kind === 'document') {
    const validated = validateDocument(json);
    if (!validated.ok) return validated;
    return { ok: true, kind, document: validated.document, ref: await headRef(repoPath) };
  }
  if (kind === 'review') {
    const validated = validateReview(json);
    if (!validated.ok) return validated;
    return resolveReview(store, repoPath, validated.review);
  }
  const wrapped = isWrappedFlow(json) ? json : { flow: json };
  const delivery = flowDeliverySchema.safeParse(wrapped);
  if (!delivery.success) {
    // Flödesvalideringen ger de läsbara felen; omslaget lägger bara till compare
    const validated = validateFlow(wrapped.flow);
    if (!validated.ok) return validated;
    return { ok: false, errors: issuesToErrors(delivery.error.issues) };
  }
  return checkSources(repoPath, delivery.data.flow, delivery.data.compare);
}

function isWrappedFlow(json: unknown): json is { flow: unknown; compare?: unknown } {
  return typeof json === 'object' && json !== null && 'flow' in json && !('nodes' in json);
}

function issuesToErrors(issues: readonly { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

async function checkSources(repoPath: string, flow: Flow, compare?: FlowCompare): Promise<Parsed> {
  const head = await headRef(repoPath);
  let ref: AnalysisRef | null = head;
  let resolvedCompare = compare;
  if (compare) {
    const headCommit = await resolveCommit(repoPath, compare.headLabel);
    if (headCommit) ref = { branch: compare.headLabel, commit: headCommit };
    const baseCommit = await resolveCommit(repoPath, compare.baseLabel);
    if (baseCommit) resolvedCompare = { ...compare, baseCommit };
  }
  // Är commiten utcheckad räcker arbetsträdet, som även har ocommittade ändringar.
  const verifyAt = ref && ref.commit !== head?.commit ? ref.commit : null;
  const errors = await verifySources(repoPath, flow, verifyAt);
  if (errors.length > 0) return { ok: false, errors };
  return resolvedCompare
    ? { ok: true, kind: 'flow', flow, compare: resolvedCompare, ref }
    : { ok: true, kind: 'flow', flow, ref };
}

async function resolveReview(
  store: AnalysisStore,
  repoPath: string,
  review: Review,
): Promise<Parsed> {
  const flows = new Map<string, SavedAnalysis | null>();
  for (const name of review.flows) flows.set(name, await store.get(repoPath, 'flow', name));
  const errors = checkFindingTargets(review, (name) => {
    const saved = flows.get(name);
    if (saved?.kind !== 'flow') return null;
    return saved.compare ? { flow: saved.flow, base: saved.compare.base } : { flow: saved.flow };
  });
  if (errors.length > 0) return { ok: false, errors };

  const head = await headRef(repoPath);
  const headCommit = await resolveCommit(repoPath, review.headLabel);
  const baseCommit = await resolveCommit(repoPath, review.baseLabel);
  const ref: AnalysisRef | null = headCommit
    ? { branch: review.headLabel, commit: headCommit }
    : head;
  return {
    ok: true,
    kind: 'review',
    review: {
      ...review,
      ...(baseCommit ? { baseCommit } : {}),
      ...(headCommit ? { headCommit } : {}),
    },
    ref,
  };
}
