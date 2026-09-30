import { createContext, useContext } from 'react';
import { type AgentEntry, type AgentState } from '../model/protocol';
import {
  type ConversationMode,
  type ConversationSummary,
  type ReviewBranches,
} from '../model/conversation';

export interface AgentApi {
  conversations: ConversationSummary[];
  activeId: string | null;
  mode: ConversationMode | null;
  entries: AgentEntry[];
  state: AgentState;
  /** Senaste frågan, att kopiera när agenten inte gick att nå */
  lastPrompt: string | null;
  ask: (prompt: string, reviewBranches?: ReviewBranches) => void;
  stop: () => void;
  choose: (id: string) => void;
  startNew: () => void;
  selectMode: (mode: ConversationMode) => void;
}

export const AgentContext = createContext<AgentApi | null>(null);

export function useAgent(): AgentApi {
  const api = useContext(AgentContext);
  if (!api) throw new Error('useAgent must be used inside AgentProvider');
  return api;
}
