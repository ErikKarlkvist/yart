import { z } from 'zod';
import { documentSchema } from '@/common/model/document';
import { flowSchema } from '@/common/model/flow';
import { reviewSchema } from '@/common/model/review';

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
  /** Filen i repot analysen importerades från, relativt roten. Sparas om igen när filen ändras. */
  file: z.string().min(1).optional(),
  /** Branch och commit flödet beskriver. Saknas för inbyggda och repon utan git. */
  ref: analysisRefSchema.optional(),
});

const savedFlowAnalysisSchema = savedAnalysisBaseSchema.extend({
  kind: z.literal('flow'),
  flow: flowSchema,
  /** Finns när analysen är en review: `flow` är då flödet efter ändringen */
  review: reviewSchema.optional(),
});

const savedDocumentAnalysisSchema = savedAnalysisBaseSchema.extend({
  kind: z.literal('document'),
  document: documentSchema,
});

const analysisContentSchema = z.discriminatedUnion('kind', [
  savedFlowAnalysisSchema,
  savedDocumentAnalysisSchema,
]);

/** Äldre sparade flöden saknar kind; läs in dem som flow vid migration. */
export const savedAnalysisSchema = z.preprocess((value: unknown) => {
  if (typeof value === 'object' && value !== null && !('kind' in value) && 'flow' in value) {
    return { ...value, kind: 'flow' };
  }
  return value;
}, analysisContentSchema);

export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;
export type SavedFlowAnalysis = z.infer<typeof savedFlowAnalysisSchema>;
export type SavedDocumentAnalysis = z.infer<typeof savedDocumentAnalysisSchema>;
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
  return analysis.kind === 'flow' ? analysis.flow.title : analysis.document.title;
}
