import { brandText } from '@/common/model/brand';

/**
 * Beskrivningarna modellen ser för varje verktyg. Fältens betydelse ligger i
 * schemana i `@/common/model`, det här är vad verktyget gör och när det ska
 * användas.
 */
export const TOOL_DESCRIPTIONS = {
  get_guide: brandText(
    'Returns the {appName} guide: how to build good flows, documents and reviews, the full schema and an example. Call it once in the session before saving anything and follow it.',
  ),
  list_repos: brandText(
    'Lists the repositories {appName} knows about, with their absolute paths. Use it to check that the repository you work in is one of them; if it is not, saving to it adds it.',
  ),
  list_analyses: brandText(
    'Lists the flows, documents and reviews saved in {appName} for a repository: their names, titles and summaries. Use it before saving to pick a free name, to find flows a document can link to, or to reuse a flow as the starting point of a review.',
  ),
  get_analysis: brandText(
    'Returns a saved flow or document as JSON, exactly as {appName} stores it. Use it to update an existing flow instead of writing it from scratch, and before edit_document to copy the exact text to change.',
  ),
  save_flow: brandText(
    'Saves a data flow through the codebase so the user sees it as an animated sequence diagram in {appName}. Use when the user asks to create or update a flow, not for ordinary chat questions. Follow the data from the entry point the question implies (a UI action, an HTTP request, a queue message) through handlers, services, storage and external systems and back to the caller. Every existing node and call needs a real source file and line. Write each playback step in two or three explanatory sentences about what happens and why it matters. For a proposed plan, mark new or updated nodes and calls with highlight added or changed; proposed new parts may omit source. The same colours appear on arrows and playback text. When the flow describes a real branch change, include compare with the same flow as it worked before the change. After saving all new flows requested by the user, call save_document once to link them and explain how they fit together. A saved plan document can serve as that companion. Flows made only to support a review do not need another document. If the result is an error, fix the content and call the tool again with the same name.',
  ),
  save_document:
    'Saves a new document with links to saved flows, or replaces one completely. Use when the user asks for a saved document or as one companion to user-requested new flows. To change an existing document, use edit_document instead. Link all flows created for the request and explain how they fit together. Do not create a document for an ordinary chat answer or a flow made only to support a review. For a compared flow, explain the main before/after differences and practical effect; otherwise explain its purpose and main path without inventing differences. Explain thoroughly enough for a developer new to the area, and use the user’s chosen language, or the language of the request if none was chosen.',
  edit_document: brandText(
    'Changes a saved document in place: replaces exact pieces of text in content or plan, appends a section, or updates the title, summary or linked flows. Use it whenever the user asks to adjust, extend or correct an existing document, so everything they did not ask to change stays as it is. Read the document with get_analysis first and copy oldText exactly. Use save_document only for a new document or when the user asks for a full rewrite.',
  ),
  save_review: brandText(
    'Saves a review of a change as a document with findings when the user asks for a saved review. Read the diff first. Save compared flows when they materially help explain affected data paths; a review may have no flows. When a finding points into a saved flow, name that flow and its node or edge id. {appName} rejects a review if it references a flow that is not saved or a finding points at a node or edge that does not exist.',
  ),
} as const;

export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

export const REPO_PARAM_DESCRIPTION =
  'Absolute path to the repository root, the output of `git rev-parse --show-toplevel`.';
