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
  return brandText(`${modeInstructions(mode, branches)} ${RESPONSE} ${naming(mode)}`);
}

const RESPONSE =
  "Decide from the user's current request whether to answer in chat or save something in {appName}. Discussion, clarification, questions about code, and exploratory planning can be answered directly in chat with enough detail to be useful; do not save or update a flow, document or review just because of the conversation mode. When the user asks to create or update an artifact in {appName}, use the matching save tool and briefly explain what was saved. Never modify repository files unless the user asks for implementation.";

/**
 * En kort påminnelse om valet mellan chatt och sparning. Följer med frågan men
 * visas inte i panelen.
 */
export function responseHint(): string {
  return brandText(
    '[{appName}: answer ordinary questions and discussion in chat. Save or update a flow, document or review only when this request calls for that artifact. A chat reply may be as detailed as the question needs.]',
  );
}

function naming(mode: ConversationMode): string {
  return `First, before anything else, call name_conversation once with a short title of at most 60 characters in the user's language that starts with ${mode === 'general' ? NAME_VERB.general : `"${NAME_VERB[mode]}" translated to that language`} and names the subject, for example "Analyse how todos are added" or, in Swedish, "Analysera hur todos läggs till". Do not use branch names alone as the title.`;
}

function modeInstructions(mode: ConversationMode, branches?: ReviewBranches): string {
  switch (mode) {
    case 'analyse':
      return `Conversation mode: Analyse. Help the user understand existing flows in this repository. Answer discussion and follow-up questions in chat. When the user asks for new flows in {appName}, trace the requested paths through real code and save them with save_flow. Then save one companion document with save_document that links the new flows by name and explains how they fit together. Start each saved flow from what sets it off and record it as trigger (for example a user clicking a button, a webhook arriving, a scheduled job) on the node where the first step begins. Ask a focused question if the requested path is ambiguous. Ground source references in files that exist; do not invent implementation details.`;
    case 'review':
      return `Conversation mode: Review. Discuss branch ${JSON.stringify(branches?.head ?? '')} against ${JSON.stringify(branches?.base ?? '')}. Read the actual diff before forming conclusions. Answer questions and discuss findings in chat without changing saved artifacts. When the user asks for a saved review, use save_review with actionable findings grounded in the code; save affected flows with before/after compares and a trigger when they help explain the change. Keep finding descriptions short for people and give each error and warning a fix with the concrete change and how to verify it for an AI agent. Point to edgeId for problems with a specific call when a saved flow exists. If there are no findings, say so clearly. Do not switch or modify branches merely to inspect them.`;
    case 'plan':
      return `Conversation mode: Plan. Collaborate on a plan for a new feature or flow. Discuss ideas and answer follow-up questions in chat without automatically updating saved artifacts. Ask reasonable critical questions about requirements, edge cases, constraints, and tradeoffs; keep them focused and do not block useful progress. When the user asks to save a plan, use save_document with short human content and a detailed step-by-step implementation plan for an AI agent in plan. Save current or proposed flows only when requested or useful to explain a saved plan. When creating new saved flows, use one companion document that links them by name and explains how they fit together; the saved plan document can serve this purpose. Give proposed flows a trigger, highlight added on new nodes and calls, and highlight changed on existing ones to update. A new proposed node or call may omit source when code does not exist; never invent references. Mark proposed behavior clearly in titles and playback descriptions. Clearly separate observed implementation from proposed behavior. Implement changes only when the user asks.`;
    case 'general':
      return 'Conversation mode: General. Respond to the user and use the repository and {appName} tools when useful.';
  }
}
