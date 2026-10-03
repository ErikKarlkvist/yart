import { createContext, useContext } from 'react';
import { type PendingApproval } from '../ipc/channels';
import { type AgentEntry, type AgentState } from '../model/protocol';
import {
  type ConversationMode,
  type ConversationSummary,
  type ReviewBranches,
} from '../model/conversation';

export interface AgentApi {
  conversations: ConversationSummary[];
  activeId: string | null;
  mode: ConversationMode;
  entries: AgentEntry[];
  state: AgentState;
  /** Senaste frågan, att kopiera när agenten inte gick att nå */
  lastPrompt: string | null;
  ask: (prompt: string, reviewBranches?: ReviewBranches) => void;
  /** Startar en ny konversation i läget och skickar frågan där */
  askNew: (prompt: string, mode: ConversationMode) => void;
  stop: () => void;
  /** Frågor som väntar på att agenten blir klar, i den öppna konversationen */
  queued: string[];
  /** Avbryter agenten och skickar det köade meddelandet direkt */
  sendNow: (index: number) => void;
  removeQueued: (index: number) => void;
  /** Det agenten i den öppna konversationen väntar på lov för */
  approvals: PendingApproval[];
  /** Svar på ett godkännande; `answers` är svaren när agenten ställt frågor */
  answer: (id: string, allow: boolean, answers?: Record<string, string>) => void;
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
