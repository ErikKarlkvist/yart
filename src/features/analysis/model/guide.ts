import { listTodosFlow } from '@/common/model/fixtures';

/** Mappen i repot som appen bevakar, relativt repots rot. */
const REVERIK_DIR = '.reverik';
export const FLOWS_DIR = `${REVERIK_DIR}/flows`;
export const REVIEWS_DIR = `${REVERIK_DIR}/reviews`;
export const DOCUMENTS_DIR = `${REVERIK_DIR}/documents`;
export const GUIDE_FILE = `${REVERIK_DIR}/instructions.md`;

export function isFlowFile(name: string): boolean {
  return name.endsWith('.json') && !name.endsWith('.errors.json');
}

export function errorsFileFor(name: string): string {
  return name.replace(/\.json$/, '.errors.json');
}

/**
 * Guiden som AI-agenten i terminalen läser. Skrivs till `.reverik/instructions.md`
 * i repot när det öppnas. Bumpa versionen när innehållet ändras så att
 * gamla kopior skrivs över.
 */
export const GUIDE_VERSION = 12;

const HOW_TO_BUILD = `## How to build a good flow

1. Start from the entry point the user's question implies: a UI action, an HTTP request,
   a queue message, a scheduled job. Read the code and follow the data through handlers,
   routes, services, storage, caches, queues and external systems, and back to the caller.
2. Everything that exists in this repository needs a \`source\`: a path relative to the
   repository root and a 1-based line number that really exists. Reverik checks both.
   Point at the line where the function is declared (nodes) or where the call is made (edges).
   Nodes of kind \`db\`, \`cache\`, \`external\` and \`queue\` may omit \`source\`.
3. Group nodes into \`systems\`, one per deployable application or infrastructure component:
   the frontend, the API, Postgres, Redis, a webhook consumer. Reverik shows the systems first
   and lets the user zoom into each one. Every system must have at least one node.
4. Describe tables on \`db\` and \`cache\` nodes with columns, primary keys and foreign keys
   (\`references\` may only point at tables on the same node). On every edge that touches
   storage, list the \`tables\` it reads or writes. Point \`source\` on a table at the
   migration or schema file that defines it.
5. Order \`steps\` the way the flow actually runs. Responses are edges of their own going
   back to the caller, e.g. "200 OK with the todo". Every step references an edge id.
6. Keep labels short and use the code's own names (component, function, route, table).
   Write step descriptions as clear, human sentences in active voice. Say what data
   moves and why; do not merely restate the HTTP verb or say that a request "reaches"
   a component. For example, prefer "The seating page asks the API for open seats on
   the selected date" over "The first GET reaches the API." Put technical detail in
   \`description\`, \`payload\` and \`response\`.
7. If the user asks about a failure or an alternative path, model that path: the edge that
   fails, what catches it, what is rolled back or retried, and what the caller sees.
8. Use \`role\` to name a handler more specifically when useful, such as \`Hook\`, \`Action\` or
   \`Event\`. Use node kind \`queue\` for a queue, topic or event bus.
`;

const SCHEMA = `## Schema

\`\`\`ts
interface Flow {
  question: string;   // the user's question
  title: string;      // short, e.g. "Add todo"
  summary: string;    // one or two sentences about what the flow does
  systems: System[];  // at least one
  nodes: Node[];      // at least one
  edges: Edge[];      // at least one
  steps: Step[];      // playback order, at least one
}

interface Document {
  title: string;
  summary: string;      // one or two sentences for the analyses list
  content: string;      // a few short paragraphs explaining how the code works
  flows: string[];      // names of saved flows, e.g. add-todo
}

interface FlowCompare {  // on a flow that describes a change
  baseLabel: string;    // what the change is compared against, e.g. "main"
  headLabel: string;    // the change itself, e.g. "feature/todo-lists"
  base: Flow;           // the same flow as it works on base, before the change
}

interface System {
  id: string;
  kind: 'app' | 'api' | 'db' | 'cache' | 'external' | 'queue';
  label: string;
  description?: string;
}

interface Node {
  id: string;
  kind: 'ui'        // something the user interacts with: button, form, page
      | 'handler'   // client code reacting to an event: handler, hook, action
      | 'http'      // HTTP endpoint or route in a backend
      | 'service'   // internal service, module or class in a backend
      | 'db'        // database or other storage
      | 'cache'     // Redis, in-memory cache, CDN
      | 'external'  // system outside the repository: payment provider, third-party API
      | 'queue';    // queue, topic or event bus
  system: string;     // System.id
  label: string;
  role?: string;      // optional, specific type label such as "Hook", "Action" or "Event"
  description?: string;
  source?: Source;    // required unless kind is db, cache, external or queue
  tables?: Table[];   // what the node stores, mainly for db and cache
}

interface Table {
  name: string;
  description?: string;
  columns?: Column[];
  source?: Source;    // where the schema is defined
}

interface Column {
  name: string;
  type: string;
  description?: string;
  primaryKey?: boolean;
  references?: { table: string; column: string }; // foreign key to a table on the same node
}

interface Edge {
  id: string;
  from: string;       // Node.id
  to: string;         // Node.id
  label: string;      // short, e.g. "POST /api/todos" or "INSERT todos"
  payload?: string;   // what is sent, free text or example JSON
  response?: string;  // what comes back, if anything
  source: Source;     // the line where the call is made
  tables?: string[];  // Table.name on the target node
}

interface Step {
  edgeId: string;     // Edge.id
  description: string; // one sentence about what happens in this step
}

interface Source {
  file: string;       // relative to the repository root
  line: number;       // 1-based, must exist in the file
  endLine?: number;
}
\`\`\`

Ids must be unique within their list. Every \`system\`, \`from\`, \`to\`, \`edgeId\` and
\`tables\` entry must reference something that exists.
`;

const REVIEW_RULES = `## Reviews

When the user asks you to review a change (a branch against another branch, a commit,
a diff), deliver the flows the change touches and then one review document:

1. Read the diff first (\`git diff <base>...<head>\` and the changed files), then follow
   the data flows the change touches. Ignore flows the change does not affect.
2. Save each affected flow as it works on head, with a \`compare\` that holds the same
   flow as it works on base. Keep the same node and edge ids in base and head for
   things that are the same, so Reverik can show what was added, removed and changed.
   Give new things new ids.
3. Save the review: a title, a summary with the verdict, a few paragraphs about what the
   change does and how it affects the data flows, the names of the flows in \`flows\`,
   and the findings.

\`\`\`ts
interface Review {
  title: string;
  summary: string;      // one or two sentences: what the change does and the verdict
  content: string;      // a few short paragraphs about the change and its data flows
  baseLabel: string;    // what the change is compared against, e.g. "main"
  headLabel: string;    // the change itself, e.g. "feature/todo-lists"
  flows: string[];      // names of the saved flows the change touches
  findings: Finding[];  // what looks wrong or risky, may be empty
}

interface Finding {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;        // short, e.g. "The cached list is no longer invalidated"
  description: string;  // what happens and why it matters
  suggestion?: string;  // what to do instead
  flow?: string;        // the saved flow the finding is about, one of the names in flows
  nodeId?: string;      // Node.id in that flow, or in its base if the node was removed
  edgeId?: string;      // Edge.id in that flow, or in its base if the call was removed
  source?: Source;      // file and line on head
}
\`\`\`

Rules for reviews:

- Use real git references as \`headLabel\` and \`baseLabel\`, e.g. \`feature/x\`,
  \`origin/feature/x\` or a commit. Reverik checks head flows against \`headLabel\`
  when it resolves in this repository (run \`git fetch\` first), so the branch does not
  need to be checked out. If it does not resolve, the working tree is used. \`base\` is
  not checked.
- Point every finding at a flow by name and at a node or a call in it, and at a file and
  line where possible. Reverik rejects the review if a flow is not saved or a target does
  not exist. Look for: cache invalidation that disappeared, calls that are now awaited or
  reordered, work moved inside or outside a transaction, missing error handling or
  validation, N+1 queries, secrets or data leaving the system, retries and timeouts.
- If nothing looks wrong, say so with an \`info\` finding rather than inventing problems.
- Represent warnings as findings, never as warning emojis in labels.`;

const EXAMPLE = `## Example

A complete flow from a different repository, a small todo app with a React
frontend, an Express API, Postgres and Redis:

\`\`\`json
${JSON.stringify(listTodosFlow, null, 2)}
\`\`\`
`;

export function buildGuide(): string {
  return `<!-- reverik-guide v${GUIDE_VERSION}, generated by Reverik, do not edit -->
# Reverik: how to add an overview or flow

Reverik is a desktop app that shows concise documents and animated sequence
diagrams of data flows through a codebase. It is running right now and watching
this folder. The user sees new documents, flows and reviews in the app as soon
as you save them.

**Choose the deliverable that matches the question.** Use a document for a
short, high-level explanation of how the codebase or a major feature works. Use
flows for a specific request, operation or failure path. A document can link to
related flows so the reader can explore details. Do not create Mermaid, ASCII
diagrams, HTML pages or separate notes.

## Scope

Reverik tasks are read-only apart from the files in \`${REVERIK_DIR}/\`. Unless the
user explicitly asks for something else in the same message:

- Do not commit, stage, stash, branch, check out, fetch or push. Do not change git state at all.
- Do not modify, create or delete any other file in the repository: no code changes,
  no plan or notes documents, no README updates.
- Do not run builds, tests, linters or dev servers. Reading code is enough.
- Never move, rename, clean up or delete anything in \`${REVERIK_DIR}/\`. It is Reverik's
  inbox, ignored by git on purpose. "Move the files to Reverik" means they are already
  in the right place.
- Keep the reply short: which files you wrote and a few sentences on what they show.

## Deliver

- Write one JSON object matching the schema below to \`${FLOWS_DIR}/<kebab-case-name>.json\`,
  relative to the repository root. Use a name that describes the flow, e.g. \`add-todo.json\`.
- For an overall explanation or architecture overview, write one document to
  \`${DOCUMENTS_DIR}/<kebab-case-name>.json\`. Keep its summary to one or two sentences
  and its content to a few short paragraphs. Link to relevant flows by name in
  \`flows\`: the flow file name without \`.json\`, e.g. \`add-todo\`.
- Reverik validates the file as soon as it is saved. Accepted content appears in the app.
  If it is rejected, read the corresponding \`.errors.json\` file beside it, fix the content
  and save again.
- Saving a file with the same name again replaces the earlier flow. Use a new name for
  a different flow, for example a variant where something fails.
- Do not create other files in \`${REVERIK_DIR}/\`. After saving, tell the user in one or two
  sentences what the flow shows.
- A flow that describes a change is saved as \`{ "flow": Flow, "compare": FlowCompare }\`.
  A review of a change is delivered the same way, to \`${REVIEWS_DIR}/<name>.json\`, after
  its flows. See "Reviews" below.

${HOW_TO_BUILD}

${SCHEMA}

${REVIEW_RULES}

## Warnings in diagrams

- For a warning about the current code without a change, save the flow with the same
  current flow in \`compare.base\` and the same commit for both labels, then a review that
  says in its summary that this is a current-state analysis.
- After saving, check the matching \`.errors.json\` file if one appears.

${EXAMPLE}`;
}

/**
 * Skillen Claude Code läser när Reverik nås via MCP. Installeras från appen
 * i användarens skillmapp. Bumpa versionen när innehållet ändras så appen
 * kan visa att den installerade kopian är gammal.
 */
export const SKILL_VERSION = 2;

export function buildSkill(): string {
  return `---
name: reverik
description: Deliver data-flow diagrams, architecture documents and change reviews to Reverik, the desktop app that shows them. Use when the user asks for a flow, sequence diagram, data flow, overview document or review in Reverik, and whenever the Reverik MCP tools (save_flow, save_document, save_review) are available and the question is about how data moves through a codebase or what a change does to it.
---
<!-- reverik-skill v${SKILL_VERSION}, generated by Reverik, do not edit -->
# Reverik

Reverik is a desktop app that shows concise documents and animated sequence
diagrams of data flows through a codebase, and reviews of changes against them.
It is running on the user's machine and you reach it through the MCP server
\`reverik\` with the tools \`list_repos\`, \`list_analyses\`, \`get_analysis\`,
\`save_flow\`, \`save_document\` and \`save_review\`. The user sees what you save
as soon as the tool returns. If the tools are missing, ask the user to start
Reverik and connect it with the command shown in its Connect panel.

**Choose the deliverable that matches the question.** Use a document for a
short, high-level explanation of how the codebase or a major feature works. Use
flows for a specific request, operation or failure path. A document can link to
related flows so the reader can explore details. Do not create Mermaid, ASCII
diagrams, HTML pages, separate notes or files in the repository.

## Workflow

1. Find the repository root with \`git rev-parse --show-toplevel\` and pass it as
   \`repo\` to every Reverik tool.
2. Call \`list_analyses\` to see what is already saved. Reuse a name to update an
   existing flow or document, and \`get_analysis\` to start from its content.
3. Read the code and build the content following the rules below. The tool's
   input schema describes every field.
4. Call \`save_flow\`, \`save_document\` or \`save_review\` with a short kebab-case
   name such as \`add-todo\`. Reverik validates the content and checks that every
   file and line exists. If the tool returns an error, fix the content and call
   it again with the same name.
5. Reply in one or two sentences: what you saved and what it shows.

## Scope

Reverik tasks are read-only. Unless the user explicitly asks for something else
in the same message:

- Do not commit, stage, stash, branch, check out, fetch or push. Do not change git state at all.
- Do not modify, create or delete any file in the repository: no code changes,
  no plan or notes documents, no README updates. Deliver only through the tools.
- Do not run builds, tests, linters or dev servers. Reading code is enough.

${HOW_TO_BUILD}

${SCHEMA}

${REVIEW_RULES}

- For a warning about the current code without a change, save the flow with the same
  current flow in \`compare.base\` and the same commit for both labels, then a review that
  says in its summary that this is a current-state analysis.

${EXAMPLE}`;
}
