/**
 * Beskrivningarna modellen ser för varje verktyg. Fältens betydelse ligger i
 * schemana i `@/common/model`, det här är vad verktyget gör och när det ska
 * användas.
 */
export const TOOL_DESCRIPTIONS = {
  list_repos:
    'Lists the repositories Reverik knows about, with their absolute paths. Use it to check that the repository you work in is one of them; if it is not, saving to it adds it.',
  list_analyses:
    'Lists the flows, documents and reviews saved in Reverik for a repository: their names, titles and summaries. Use it before saving to pick a free name, to find flows a document can link to, or to reuse a flow as the starting point of a review.',
  get_analysis:
    'Returns a saved flow or document as JSON, exactly as Reverik stores it. Use it to update an existing flow instead of writing it from scratch.',
  save_flow:
    'Saves a data flow through the codebase so the user sees it as an animated sequence diagram in Reverik. Follow the data from the entry point the question implies (a UI action, an HTTP request, a queue message) through handlers, services, storage and external systems and back to the caller. Every node and edge that exists in the repository needs a source file and line that really exist; Reverik checks them and rejects the flow otherwise. If the result is an error, fix the content and call the tool again with the same name.',
  save_document:
    'Saves a short, high-level document about how the codebase or a major feature works, with links to saved flows for the details. Use it for architecture overviews and explanations that do not fit a single flow.',
  save_review:
    'Saves a review of a change: the same data flow before (base) and after (head) the change, with findings about what looks wrong or risky. Read the diff first, then follow the flows the change touches and ignore the rest. Keep node and edge ids stable between base and head so Reverik can show what changed. Point every finding at a node or edge and at a file and line on head.',
} as const;

export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

export const REPO_PARAM_DESCRIPTION =
  'Absolute path to the repository root, the output of `git rev-parse --show-toplevel`.';
