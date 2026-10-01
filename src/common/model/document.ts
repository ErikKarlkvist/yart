import { z } from 'zod';
import { analysisNameSchema } from './name';

/**
 * Texten människor läser. En liten del markdown: rubriker, punktlistor,
 * numrerade listor, fetstil och kod. Allt detaljerat för AI ligger i egna fält.
 */
export const READABLE_TEXT =
  'Markdown for people to skim: "## " headings, "- " bullet lists, "1. " numbered lists, **bold** and `code`. Short sentences, mostly bullets, around 150 words at most. Leave details for AI in the dedicated fields.';

/**
 * En kort, läsbar översikt av ett repo eller en plan, med länkar till mer
 * detaljerade flöden. `plan` är för AI och visas inte, den kopieras eller
 * skickas som implementationsplan.
 */
export const documentSchema = z.object({
  title: z.string().min(1).describe('Short title, e.g. "How orders are processed"'),
  summary: z
    .string()
    .min(1)
    .max(500)
    .describe('One or two sentences shown in the list of analyses'),
  content: z
    .string()
    .min(1)
    .describe(
      `${READABLE_TEXT} Explain the code at a high level. For a document linked to a compared flow, explain the important before/after differences and practical effect.`,
    ),
  plan: z
    .string()
    .min(1)
    .optional()
    .describe(
      'For a document that proposes a change: a detailed implementation plan for an AI coding agent, in Markdown. Concrete ordered steps with files, functions, data changes, edge cases and how to verify each step. Not shown to the user; they copy it or send it to their agent.',
    ),
  flows: z
    .array(analysisNameSchema)
    .default([])
    .describe('Names of saved flows the document links to, so the reader can explore the details'),
});

export type YartDocument = z.infer<typeof documentSchema>;

export function validateDocument(
  input: unknown,
): { ok: true; document: YartDocument } | { ok: false; errors: string[] } {
  const result = documentSchema.safeParse(input);
  if (result.success) return { ok: true, document: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}
