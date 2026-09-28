import { z } from 'zod';
import { documentSchema } from '@/common/model/document';
import { flowSchema } from '@/common/model/flow';
import { analysisNameSchema, nameFromFile } from '@/common/model/name';
import { flowCompareSchema, type ReviewFinding, reviewSchema } from '@/common/model/review';

const analysisOriginSchema = z.enum([
  /** Inbyggd grundanalys som följer med appen, går inte att ta bort */
  'builtin',
  /** Producerad av AI-analysen */
  'ai',
]);

/** Var i historiken analysen gäller: branch och commit när den importerades. */
const analysisRefSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().min(1),
});

const savedAnalysisBaseSchema = z.object({
  id: z.string().min(1),
  /** Absolut sökväg till repot analysen gäller */
  repoPath: z.string().min(1),
  origin: analysisOriginSchema,
  createdAt: z.string(),
  /** Namnet analysen sparades under. Samma namn och sort igen ersätter den. */
  name: analysisNameSchema,
  /** Filen i repot analysen importerades från, relativt roten, när den kom via inkorgen. */
  file: z.string().min(1).optional(),
  /** Branch och commit flödet beskriver. Saknas för inbyggda och repon utan git. */
  ref: analysisRefSchema.optional(),
});

const savedFlowAnalysisSchema = savedAnalysisBaseSchema.extend({
  kind: z.literal('flow'),
  flow: flowSchema,
  /** Finns när flödet beskriver en ändring: `flow` är då flödet efter den */
  compare: flowCompareSchema.optional(),
});

const savedReviewAnalysisSchema = savedAnalysisBaseSchema.extend({
  kind: z.literal('review'),
  review: reviewSchema,
});

const savedDocumentAnalysisSchema = savedAnalysisBaseSchema.extend({
  kind: z.literal('document'),
  document: documentSchema,
});

const analysisContentSchema = z.discriminatedUnion('kind', [
  savedFlowAnalysisSchema,
  savedDocumentAnalysisSchema,
  savedReviewAnalysisSchema,
]);

/**
 * Äldre sparade analyser saknar kind och name, och flöden bar sin review
 * själva. Kind blir flow, name tas ur filnamnet eller id:t och reviewn blir
 * en jämförelse utan fynd, så gamla filer under userData går att läsa.
 */
export const savedAnalysisSchema = z.preprocess((value: unknown) => {
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  const kind = 'kind' in record || !('flow' in record) ? {} : { kind: 'flow' };
  const name =
    'name' in record
      ? {}
      : {
          name: typeof record.file === 'string' ? nameFromFile(record.file) : legacyName(record.id),
        };
  const review = record.review;
  if ('flow' in record && typeof review === 'object' && review !== null && 'base' in review) {
    const { review: _review, ...rest } = record;
    const { findings: _findings, ...compare } = review as Record<string, unknown>;
    return { ...rest, ...kind, ...name, compare };
  }
  return { ...record, ...kind, ...name };
}, analysisContentSchema);

function legacyName(id: unknown): string {
  return `legacy-${String(id).replace(/[^a-zA-Z0-9._-]/g, '-')}`;
}

/** Ett namn ur en titel: "Add todo" blir "add-todo". */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'analysis';
}

export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;
export type SavedFlowAnalysis = z.infer<typeof savedFlowAnalysisSchema>;
export type SavedDocumentAnalysis = z.infer<typeof savedDocumentAnalysisSchema>;
export type SavedReviewAnalysis = z.infer<typeof savedReviewAnalysisSchema>;
export type AnalysisRef = z.infer<typeof analysisRefSchema>;

export const savedAnalysesSchema = z.array(savedAnalysisSchema);

/** Nyast först. */
export function sortAnalyses(list: readonly SavedAnalysis[]): SavedAnalysis[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Rubrik för gruppen en analys hör till i listan: branch och kort commit. */
export function refLabel(ref: AnalysisRef): string {
  return `${ref.branch ?? ref.commit.slice(0, 7)} · ${ref.commit.slice(0, 7)}`;
}

export function analysisTitle(analysis: SavedAnalysis): string {
  switch (analysis.kind) {
    case 'flow':
      return analysis.flow.title;
    case 'document':
      return analysis.document.title;
    case 'review':
      return analysis.review.title;
  }
}

/** Fynden i repots reviewer som pekar på ett flöde, för grafen och Review-fliken. */
export function findingsForFlow(analyses: readonly SavedAnalysis[], name: string): ReviewFinding[] {
  return analyses.flatMap((analysis) =>
    analysis.kind === 'review' ? analysis.review.findings.filter((f) => f.flow === name) : [],
  );
}

/** Reviewn som hör till en analys: analysen själv, eller den första som pekar på flödet. */
export function reviewFor(
  analyses: readonly SavedAnalysis[],
  current: SavedAnalysis | null,
): SavedReviewAnalysis | null {
  if (!current) return null;
  if (current.kind === 'review') return current;
  if (current.kind !== 'flow') return null;
  const name = current.name;
  return (
    analyses.find(
      (a): a is SavedReviewAnalysis => a.kind === 'review' && a.review.flows.includes(name),
    ) ?? null
  );
}
