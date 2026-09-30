import { brandText } from '@/common/model/brand';

/**
 * Beskrivningarna modellen ser för varje verktyg. Fältens betydelse ligger i
 * schemana i `@/common/model`, det här är vad verktyget gör och när det ska
 * användas.
 */
export const TOOL_DESCRIPTIONS = {
  list_repos: brandText(
    'Lists the repositories {appName} knows about, with their absolute paths. Use it to check that the repository you work in is one of them; if it is not, saving to it adds it.',
  ),
  list_analyses: brandText(
    'Lists the flows, documents and reviews saved in {appName} for a repository: their names, titles and summaries. Use it before saving to pick a free name, to find flows a document can link to, or to reuse a flow as the starting point of a review.',
  ),
  get_analysis: brandText(
    'Returns a saved flow or document as JSON, exactly as {appName} stores it. Use it to update an existing flow instead of writing it from scratch.',
  ),
  save_flow: brandText(
    'Saves a data flow through the codebase so the user sees it as an animated sequence diagram in {appName}. Follow the data from the entry point the question implies (a UI action, an HTTP request, a queue message) through handlers, services, storage and external systems and back to the caller. Every existing node and call needs a real source file and line. For a proposed plan, mark new or updated nodes and calls with highlight added or changed; proposed new parts may omit source. The same colours appear on arrows and playback text. When the flow describes a real branch change, include compare with the same flow as it worked before the change. If the user asked for a new flow, follow this successful save with save_document: link this flow and briefly explain the important differences when compare is present, or its purpose and main path otherwise. Do not add a separate document for flows made only to support a review. If the result is an error, fix the content and call the tool again with the same name.',
  ),
  save_document:
    'Saves a short, high-level document with links to saved flows. Use it for architecture overviews and as a companion to a user-requested new flow. For a compared flow, explain the main before/after differences and practical effect; otherwise explain its purpose and main path without inventing differences. Keep it concise and use the user’s chosen language, or the language of the request if none was chosen.',
  save_review: brandText(
    'Saves a review of a change as a document with findings. First save every data flow the change touches with save_flow and a compare, then call this with the names of those flows and findings that point into them by flow name and node or edge id. Read the diff first and ignore flows the change does not affect. {appName} rejects the review if a flow is not saved or a finding points at a node or edge that does not exist.',
  ),
} as const;

export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

export const REPO_PARAM_DESCRIPTION =
  'Absolute path to the repository root, the output of `git rev-parse --show-toplevel`.';
