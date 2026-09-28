import { headRef, resolveCommit } from '@/common/main/git';
import { type ReverikDocument, validateDocument } from '@/common/model/document';
import { type Flow, validateFlow } from '@/common/model/flow';
import { type Review, validateReviewDocument } from '@/common/model/review';
import { type AnalysisRef, type SavedAnalysis } from '../model/analysis';
import { type AnalysisStore, type NewAnalysis } from './store';
import { verifySources } from './verify';

/** Vad en leverans säger sig vara. En review sparas som ett flöde med review. */
export type IntakeKind = 'flow' | 'review' | 'document';

export type IntakeResult =
  | { type: 'imported'; analysis: SavedAnalysis }
  | { type: 'rejected'; errors: string[] }
  /** Samma innehåll finns redan sparat under namnet */
  | { type: 'unchanged'; analysis: SavedAnalysis };

type Parsed =
  | { ok: true; kind: 'flow'; flow: Flow; review?: Review; ref: AnalysisRef | null }
  | { ok: true; kind: 'document'; document: ReverikDocument; ref: AnalysisRef | null }
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
  file?: string,
): Promise<IntakeResult> {
  const parsed = await parseAndVerify(repoPath, json, kind);
  if (!parsed.ok) return { type: 'rejected', errors: parsed.errors };

  const existing = await store.get(repoPath, parsed.kind, name);
  if (existing && existing.ref?.commit === parsed.ref?.commit && sameContent(existing, parsed)) {
    return { type: 'unchanged', analysis: existing };
  }
  const shared = { name, ...(file ? { file } : {}), ref: parsed.ref };
  const input: NewAnalysis =
    parsed.kind === 'document'
      ? { ...shared, kind: 'document', document: parsed.document }
      : {
          ...shared,
          kind: 'flow',
          flow: parsed.flow,
          ...(parsed.review ? { review: parsed.review } : {}),
        };
  return { type: 'imported', analysis: await store.upsert(repoPath, input) };
}

function sameContent(existing: SavedAnalysis, parsed: Parsed & { ok: true }): boolean {
  if (parsed.kind === 'document') {
    return (
      existing.kind === 'document' &&
      JSON.stringify(existing.document) === JSON.stringify(parsed.document)
    );
  }
  return (
    existing.kind === 'flow' &&
    JSON.stringify(existing.flow) === JSON.stringify(parsed.flow) &&
    JSON.stringify(existing.review) === JSON.stringify(parsed.review)
  );
}

/**
 * Ett flöde beskriver arbetsträdet och kontrolleras mot det. En reviews head
 * kontrolleras mot branchen den säger sig beskriva om den finns i repot och
 * inte är utcheckad, annars mot arbetsträdet. Base beskriver en annan branch
 * och kontrolleras inte.
 */
async function parseAndVerify(repoPath: string, json: unknown, kind: IntakeKind): Promise<Parsed> {
  if (kind === 'document') {
    const validated = validateDocument(json);
    if (!validated.ok) return validated;
    return { ok: true, kind, document: validated.document, ref: await headRef(repoPath) };
  }
  if (kind === 'review') {
    const validated = validateReviewDocument(json);
    if (!validated.ok) return validated;
    return checkSources(repoPath, validated.flow, validated.review);
  }
  const validated = validateFlow(json);
  if (!validated.ok) return validated;
  return checkSources(repoPath, validated.flow);
}

async function checkSources(repoPath: string, flow: Flow, review?: Review): Promise<Parsed> {
  const head = await headRef(repoPath);
  let ref: AnalysisRef | null = head;
  let resolvedReview = review;
  if (review) {
    const headCommit = await resolveCommit(repoPath, review.headLabel);
    if (headCommit) ref = { branch: review.headLabel, commit: headCommit };
    const baseCommit = await resolveCommit(repoPath, review.baseLabel);
    if (baseCommit) resolvedReview = { ...review, baseCommit };
  }
  // Är commiten utcheckad räcker arbetsträdet, som även har ocommittade ändringar.
  const verifyAt = ref && ref.commit !== head?.commit ? ref.commit : null;
  const errors = await verifySources(repoPath, flow, verifyAt);
  if (errors.length > 0) return { ok: false, errors };
  return resolvedReview
    ? { ok: true, kind: 'flow', flow, review: resolvedReview, ref }
    : { ok: true, kind: 'flow', flow, ref };
}
