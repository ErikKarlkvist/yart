import { z } from 'zod';
import { analysisNameSchema } from './name';

/** En kort, läsbar översikt av ett repo med länkar till mer detaljerade flöden. */
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
      'A few short paragraphs, separated by blank lines, explaining the code at a high level. For a document linked to a compared flow, explain the important before/after differences and practical effect.',
    ),
  flows: z
    .array(analysisNameSchema)
    .default([])
    .describe('Names of saved flows the document links to, so the reader can explore the details'),
});

export type ReverikDocument = z.infer<typeof documentSchema>;

export function validateDocument(
  input: unknown,
): { ok: true; document: ReverikDocument } | { ok: false; errors: string[] } {
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
