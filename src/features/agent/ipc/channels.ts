import { defineChannel, defineEvent } from '@/common/ipc/channel';
import { type AgentKind, type AgentSettings, type RunnableAgent } from '@/common/model/agent';
import { type AgentCheck, type AgentEntry, type AgentState } from '../model/protocol';
import {
  type Conversation,
  type ConversationMode,
  type ConversationSummary,
  type ReviewBranches,
} from '../model/conversation';

export const listConversationsChannel = defineChannel<{ repoPath: string }, ConversationSummary[]>(
  'agent:list-conversations',
);
export const getConversationChannel = defineChannel<
  { repoPath: string; id: string },
  Conversation | null
>('agent:get-conversation');
export const createConversationChannel = defineChannel<
  { repoPath: string; agent: AgentKind; mode: ConversationMode; reviewBranches?: ReviewBranches },
  Conversation
>('agent:create-conversation');

/**
 * Skickar en fråga till repots agentsession och startar den om den inte
 * kör. Svaret kommer som `agentEvent`. Misslyckas starten svarar kanalen
 * ändå; felet syns i panelen.
 */
export const askAgentChannel = defineChannel<{
  repoPath: string;
  agent: AgentKind;
  settings: AgentSettings;
  prompt: string;
  conversationId: string;
}>('agent:ask');

export const stopAgentChannel = defineChannel<{ repoPath: string; conversationId: string }>(
  'agent:stop',
);

/** Frågar Claude Code om den finns och är inloggad. Tar en sekund eller två. */
export const checkAgentChannel = defineChannel<{ agent: RunnableAgent }, AgentCheck>('agent:check');

/** Något agenten vill göra och väntar på lov för. */
export interface PendingApproval {
  id: string;
  /** Verktyget, t.ex. Bash eller Edit */
  tool: string;
  /** Kommandot, filen eller annan kort beskrivning */
  detail: string;
}

/** Användarens svar på ett godkännande. Agenten fortsätter direkt. */
export const answerApprovalChannel = defineChannel<{ id: string; allow: boolean }>(
  'agent:answer-approval',
);

export type AgentEvent =
  | { type: 'entry'; repoPath: string; conversationId: string; entry: AgentEntry }
  | { type: 'state'; repoPath: string; conversationId: string; state: AgentState }
  | { type: 'approval'; repoPath: string; conversationId: string; approval: PendingApproval }
  | { type: 'approval-done'; repoPath: string; conversationId: string; id: string }
  | { type: 'title'; repoPath: string; conversationId: string; title: string };

export const agentEvent = defineEvent<AgentEvent>('agent:event');
