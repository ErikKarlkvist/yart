import { type ConversationMode, type ReviewBranches } from './conversation';

/** Verbet konversationens namn börjar med, på användarens språk. */
const NAME_VERB: Readonly<Record<ConversationMode, string>> = {
  analyse: 'Analyse',
  review: 'Review',
  plan: 'Plan',
  general: 'a verb that fits the question',
};

/** Stable background instructions for each conversation's purpose. */
export function conversationInstructions(
  mode: ConversationMode,
  branches?: ReviewBranches,
): string {
  return `${modeInstructions(mode, branches)} ${mode === 'general' ? '' : `${DELIVER} `}${naming(mode)}`;
}

/**
 * Lägena som levererar till Reverik. Svaret hör hemma i appen, inte i chatten:
 * utan det här skriver agenten gärna en lång rapport i stället för att spara.
 */
const DELIVER =
  'Deliver the answer in Reverik, not in the chat: the user reads flows, documents and reviews in the app, and the chat is only for a one or two sentence confirmation of what you saved, or a short question when you need an answer before you can continue. Never write reports, call-chain summaries, code listings or file lists in the chat; put that detail into the saved flow (sources, descriptions, payloads) and the document instead. If the Reverik tools are not available, say so in one sentence instead of answering in the chat.';

/** Verktygen som sparar något i Reverik, med eller utan MCP-prefix */
export function isDeliveryTool(name: string): boolean {
  return /(^|[_.])save_(flow|document|review)$/.test(name);
}

/**
 * Påminnelsen appen skickar när agenten avslutat en tur utan att spara något,
 * i lägen där svaret ska levereras i Reverik. null när chatten räcker.
 */
export function deliveryReminder(mode: ConversationMode): string | null {
  switch (mode) {
    case 'analyse':
      return 'Nothing was saved in Reverik this turn. Save what you found: the flow with save_flow, including its trigger, and a short document with save_document that links it. Then reply in one or two sentences. If you are waiting for an answer from the user, say so in one sentence instead.';
    case 'review':
      return 'Nothing was saved in Reverik this turn. Save the affected flows with save_flow, each with a compare, and then the review with save_review. Then reply in one or two sentences. If you are waiting for an answer from the user, say so in one sentence instead.';
    case 'plan':
      return 'Nothing was saved in Reverik this turn. Save the planning document with save_document, with short content for people and the detailed plan for an AI agent in plan, and any proposed flows with save_flow. Then reply in one or two sentences. If you are waiting for an answer from the user, say so in one sentence instead.';
    case 'general':
      return null;
  }
}

function naming(mode: ConversationMode): string {
  return `First, before anything else, call name_conversation once with a short title of at most 60 characters in the user's language that starts with ${mode === 'general' ? NAME_VERB.general : `"${NAME_VERB[mode]}" translated to that language`} and names the subject, for example "Analyse how todos are added" or, in Swedish, "Analysera hur todos läggs till". Do not use branch names alone as the title.`;
}

function modeInstructions(mode: ConversationMode, branches?: ReviewBranches): string {
  switch (mode) {
    case 'analyse':
      return `Conversation mode: Analyse. Help the user understand existing flows in this repository. Trace the requested paths through real code and save each useful flow with save_flow. Start every flow from what sets it off and record it as trigger (for example a user clicking a button, a webhook arriving, a scheduled job) on the node where the first step begins. Use save_document when the flow needs a written explanation. Write content for people: short Markdown with headings and bullets; put detail for AI in the dedicated fields. Ask a focused question if the requested flow is ambiguous. Ground source references in files that exist; do not invent implementation details.`;
    case 'review':
      return `Conversation mode: Review. Review branch ${JSON.stringify(branches?.head ?? '')} against ${JSON.stringify(branches?.base ?? '')}. Read the actual diff before forming conclusions. Save affected flows with before/after compares, each with its trigger, then save_review with actionable findings grounded in the code. Keep finding descriptions short for people and give each error and warning a fix with the concrete change and how to verify it for an AI agent. Point to edgeId for problems with a specific call so the arrow and playback text are highlighted. If there are no findings, say so clearly. Do not switch or modify branches merely to inspect them.`;
    case 'plan':
      return `Conversation mode: Plan. Collaborate on a plan for a new feature or flow. Ask reasonable critical questions about requirements, edge cases, constraints, and tradeoffs; keep them focused and do not block useful progress. Trace and save current or older flows when they help explain the design. Save proposed flows with their trigger and with highlight added on new nodes and calls, and highlight changed on existing ones to update; update these flows as the plan evolves. A new proposed node or call may omit source when code does not exist; never invent references. Mark proposed behavior clearly in titles and playback descriptions. Maintain a planning document with save_document and update it as decisions change during the conversation: short human content, and the detailed step-by-step implementation plan for an AI agent in plan. Clearly separate observed implementation from proposed behavior. Implement changes only when the user asks.`;
    case 'general':
      return 'Conversation mode: General. Respond to the user and use the repository and Reverik tools when useful.';
  }
}
