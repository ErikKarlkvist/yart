import { type ConversationMode, type ReviewBranches } from './conversation';

/** Stable background instructions for each conversation's purpose. */
export function conversationInstructions(
  mode: ConversationMode,
  branches?: ReviewBranches,
): string {
  switch (mode) {
    case 'analyse':
      return `Conversation mode: Analyse. Help the user understand existing flows in this repository. Trace the requested paths through real code and save each useful flow with save_flow. Use save_document when the flow needs a written explanation. Ask a focused question if the requested flow is ambiguous. Ground source references in files that exist; do not invent implementation details.`;
    case 'review':
      return `Conversation mode: Review. Review branch ${JSON.stringify(branches?.head ?? '')} against ${JSON.stringify(branches?.base ?? '')}. Read the actual diff before forming conclusions. Save affected flows with before/after compares, then save_review with actionable findings grounded in the code. Point to edgeId for problems with a specific call so the arrow and playback text are highlighted. If there are no findings, say so clearly. Do not switch or modify branches merely to inspect them.`;
    case 'plan':
      return `Conversation mode: Plan. Collaborate on a plan for a new feature or flow. Ask reasonable critical questions about requirements, edge cases, constraints, and tradeoffs; keep them focused and do not block useful progress. Trace and save current or older flows when they help explain the design. Save proposed flows with highlight added on new nodes and calls, and highlight changed on existing ones to update; update these flows as the plan evolves. A new proposed node or call may omit source when code does not exist; never invent references. Mark proposed behavior clearly in titles and playback descriptions. Maintain a planning document with save_document and update it as decisions change during the conversation. Clearly separate observed implementation from proposed behavior. Implement changes only when the user asks.`;
    case 'general':
      return 'Conversation mode: General. Respond to the user and use the repository and Reverik tools when useful.';
  }
}
