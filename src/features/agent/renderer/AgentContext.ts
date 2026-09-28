import { createContext, useContext } from 'react';
import { type AgentEntry, type AgentState } from '../model/protocol';

export interface AgentApi {
  entries: AgentEntry[];
  state: AgentState;
  /** Senaste frågan, att kopiera när agenten inte gick att nå */
  lastPrompt: string | null;
  ask: (prompt: string) => void;
  stop: () => void;
}

export const AgentContext = createContext<AgentApi | null>(null);

export function useAgent(): AgentApi {
  const api = useContext(AgentContext);
  if (!api) throw new Error('useAgent must be used inside AgentProvider');
  return api;
}
