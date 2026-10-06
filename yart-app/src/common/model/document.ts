import { z } from 'zod';
import { t } from './i18n';
import { analysisNameSchema } from './name';

/**
 * Texten människor läser. En liten del markdown: rubriker, punktlistor,
 * numrerade listor, fetstil och kod. Allt detaljerat för AI ligger i egna fält.
 */
export const READABLE_TEXT =
  'Markdown for people to skim: "## " headings, "- " bullet lists, "1. " numbered lists, **bold** and `code`. Short sentences, mostly bullets, around 150 words at most. Leave details for AI in the dedicated fields.';

/**
 * Dokumentens text: utförligare än reviewer, så en utvecklare som är ny i
 * området förstår helheten utan att läsa koden först.
 */
const DOCUMENT_TEXT =
  'Markdown for people: "## " headings, short paragraphs, "- " bullet lists, "1. " numbered lists, **bold** and `code`. Explain thoroughly enough that a developer new to this area understands it without reading the code first: the purpose, the main parts and how they work together, how the linked flows fit in, important decisions and constraints, edge cases and risks. Usually 300 to 800 words; longer when the subject needs it. Avoid repeating every flow step.';

/**
 * En läsbar översikt av ett repo eller en plan, med länkar till mer
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
      `${DOCUMENT_TEXT} For a document linked to a compared flow, explain the important before/after differences and practical effect.`,
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

/** En ändring i ett sparat dokument: exakt text som byts mot ny, som Edit i en editor. */
export const documentEditSchema = z.object({
  field: z
    .enum(['content', 'plan'])
    .default('content')
    .describe('The field to change: content (shown to people) or plan (for an AI agent)'),
  oldText: z
    .string()
    .min(1)
    .describe(
      'Exact text in the field to replace, including whitespace. Must appear exactly once.',
    ),
  newText: z.string().describe('The replacement. Empty removes the text.'),
});

/** Det `edit_document` ändrar: textbyten och de fält som skickas med. */
export const documentPatchSchema = z.object({
  title: z.string().min(1).optional().describe('New title; omit to keep it'),
  summary: z.string().min(1).max(500).optional().describe('New summary; omit to keep it'),
  flows: z
    .array(analysisNameSchema)
    .optional()
    .describe('The full new list of linked flows; omit to keep the current links'),
  edits: z
    .array(documentEditSchema)
    .default([])
    .describe('Text replacements, applied in order. Each oldText must appear exactly once.'),
  append: z
    .string()
    .min(1)
    .optional()
    .describe('Markdown to add at the end of content, e.g. a new section'),
});

export type DocumentPatch = z.infer<typeof documentPatchSchema>;

/**
 * Ändrar ett sparat dokument i stället för att skriva om det. Varje byte måste
 * träffa exakt ett ställe, annars avvisas hela ändringen med fel till agenten.
 */
export function applyDocumentPatch(
  document: YartDocument,
  patch: DocumentPatch,
): { ok: true; document: YartDocument } | { ok: false; errors: string[] } {
  const next: YartDocument = {
    ...document,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
    ...(patch.flows !== undefined ? { flows: patch.flows } : {}),
  };
  const errors: string[] = [];
  patch.edits.forEach((change, i) => {
    const text = next[change.field] ?? '';
    const count = text.split(change.oldText).length - 1;
    if (count !== 1) {
      errors.push(
        t(count === 0 ? 'document.editNotFound' : 'document.editAmbiguous', {
          index: i + 1,
          field: change.field,
          count,
        }),
      );
      return;
    }
    next[change.field] = text.replace(change.oldText, () => change.newText);
  });
  if (patch.append !== undefined) next.content = `${next.content.trimEnd()}\n\n${patch.append}`;
  if (errors.length > 0) return { ok: false, errors };
  if (next.plan === '') delete next.plan;
  return validateDocument(next);
}
