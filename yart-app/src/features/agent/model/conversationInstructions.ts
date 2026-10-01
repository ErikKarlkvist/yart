import { brandText } from '@/common/model/brand';
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
  return brandText(
    `${modeInstructions(mode, branches)} ${RESPONSE} ${COMPLETE_FLOWS} ${naming(mode)}`,
  );
}

const RESPONSE =
  'Decide per request whether to deliver in {appName} or answer in chat. The first request of a conversation starts a new analysis, review or plan: deliver it in {appName} with the save tools, unless it is only a greeting or a quick factual question. For later requests, save or update when the request changes what a saved artifact should show (another path, a correction, more detail, a failure case, a proposed change) or asks to see, draw, map or trace something; answer in chat when it asks for an explanation, an opinion or a clarification. Decide yourself; do not ask whether to save. After saving, briefly explain what was saved. Never modify repository files unless the user asks for implementation.';

/** Hur fullständigt ett flöde ska vara; gäller alla lägen som sparar flöden. */
const COMPLETE_FLOWS =
  'A saved flow must cover every call on the path: each hop between components, calls between modules inside a service, every database, cache, queue and external request, and the response back to each caller. Do not merge or skip calls to keep it short. Before saving, walk the code again from the trigger to the final response and check that every call has an edge and a step, and that each part of the request is answered.';

/**
 * En kort påminnelse om valet mellan chatt och sparning. Följer med frågan men
 * visas inte i panelen. Den första frågan i en konversation är en ny analys.
 */
export function responseHint(first: boolean): string {
  return brandText(
    first
      ? '[{appName}: this request starts the conversation. Deliver it in {appName} with the save tools unless it is only a greeting or a quick factual question. Answer every part of the request.]'
      : '[{appName}: follow-up. Save or update an artifact when this request changes what it should show or asks to see or trace something; answer explanations and discussion in chat. Answer every part of the request.]',
  );
}

function naming(mode: ConversationMode): string {
  return `First, before anything else, call name_conversation once with a short title of at most 60 characters in the user's language that starts with ${mode === 'general' ? NAME_VERB.general : `"${NAME_VERB[mode]}" translated to that language`} and names the subject, for example "Analyse how todos are added" or, in Swedish, "Analysera hur todos läggs till". Do not use branch names alone as the title.`;
}

function modeInstructions(mode: ConversationMode, branches?: ReviewBranches): string {
  switch (mode) {
    case 'analyse':
      return `Conversation mode: Analyse. Help the user understand existing flows in this repository. A new analysis is delivered as flows: trace the requested paths through real code and save them with save_flow. Answer discussion and follow-up questions in chat. Then save one companion document with save_document that links the new flows by name and explains how they fit together. Start each saved flow from what sets it off and record it as trigger (for example a user clicking a button, a webhook arriving, a scheduled job) on the node where the first step begins. Ask a focused question if the requested path is ambiguous. Ground source references in files that exist; do not invent implementation details.`;
    case 'review':
      return `Conversation mode: Review. Discuss branch ${JSON.stringify(branches?.head ?? '')} against ${JSON.stringify(branches?.base ?? '')}. Read the actual diff before forming conclusions. The first request is delivered as a saved review with save_review; answer later questions about findings in chat. Use save_review with actionable findings grounded in the code; save affected flows with before/after compares and a trigger when they help explain the change. Keep finding descriptions short for people and give each error and warning a fix with the concrete change and how to verify it for an AI agent. Point to edgeId for problems with a specific call when a saved flow exists. If there are no findings, say so clearly. Do not switch or modify branches merely to inspect them.`;
    case 'plan':
      return `Conversation mode: Plan. Collaborate on a plan for a new feature or flow. When the first request describes what to build, save a plan document with the proposed flows; if the requirements are too unclear to plan, ask a few focused questions first. Discuss follow-up ideas in chat and update the saved plan when the plan changes. Ask reasonable critical questions about requirements, edge cases, constraints, and tradeoffs; keep them focused and do not block useful progress. When the user asks to save a plan, use save_document with short human content and a detailed step-by-step implementation plan for an AI agent in plan. Save current or proposed flows only when requested or useful to explain a saved plan. When creating new saved flows, use one companion document that links them by name and explains how they fit together; the saved plan document can serve this purpose. Give proposed flows a trigger, highlight added on new nodes and calls, and highlight changed on existing ones to update. A new proposed node or call may omit source when code does not exist; never invent references. Mark proposed behavior clearly in titles and playback descriptions. Clearly separate observed implementation from proposed behavior. Implement changes only when the user asks.`;
    case 'general':
      return 'Conversation mode: General. Respond to the user and use the repository and {appName} tools when useful.';
  }
}
