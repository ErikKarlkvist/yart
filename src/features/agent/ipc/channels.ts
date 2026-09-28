import { defineChannel, defineEvent } from '@/common/ipc/channel';
import {
  type AgentCheck,
  type AgentEntry,
  type AgentKind,
  type AgentState,
} from '../model/protocol';

/**
 * Skickar en fråga till repots agentsession och startar den om den inte
 * kör. Svaret kommer som `agentEvent`. Misslyckas starten svarar kanalen
 * ändå; felet syns i panelen.
 */
export const askAgentChannel = defineChannel<{
  repoPath: string;
  agent: AgentKind;
  prompt: string;
}>('agent:ask');

export const stopAgentChannel = defineChannel<{ repoPath: string }>('agent:stop');

/** Frågar Claude Code om den finns och är inloggad. Tar en sekund eller två. */
export const checkAgentChannel = defineChannel<undefined, AgentCheck>('agent:check');

export type AgentEvent =
  | { type: 'entry'; repoPath: string; entry: AgentEntry }
  | { type: 'state'; repoPath: string; state: AgentState };

export const agentEvent = defineEvent<AgentEvent>('agent:event');
