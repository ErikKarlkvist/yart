import { z } from 'zod';

const flowFileSchema = z.string().regex(/^\.reverik\/flows\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/);

/** En kort, läsbar översikt av ett repo med länkar till mer detaljerade flöden. */
export const documentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).max(500),
  content: z.string().min(1),
  flowFiles: z.array(flowFileSchema).default([]),
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
