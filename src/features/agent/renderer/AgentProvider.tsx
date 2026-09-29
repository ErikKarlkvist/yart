import { type JSX, type ReactNode, useCallback, useMemo, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { useIpcEvent } from '@/common/renderer/useIpcEvent';
import { type AgentEvent, agentEvent, askAgentChannel, stopAgentChannel } from '../ipc/channels';
import { type AgentKind } from '@/common/model/agent';
import { type AgentEntry, type AgentState } from '../model/protocol';
import { AgentContext } from './AgentContext';

interface Props {
  repoPath: string | null;
  /** Vilken agent användaren valt; bara Claude Code kan köras i bakgrunden */
  agent: AgentKind;
  children: ReactNode;
}

interface Tagged<T> {
  repoPath: string;
  value: T;
}

/**
 * Samtalet med repots agentsession. Allt state taggas med repots sökväg,
 * så byte av repo ger ett tomt samtal utan nollställning i en effekt.
 */
export function AgentProvider({ repoPath, agent, children }: Props): JSX.Element {
  const [entries, setEntries] = useState<Tagged<AgentEntry[]> | null>(null);
  const [state, setState] = useState<Tagged<AgentState> | null>(null);
  const [lastPrompt, setLastPrompt] = useState<Tagged<string> | null>(null);

  const onEvent = useCallback(
    (event: AgentEvent) => {
      if (event.repoPath !== repoPath) return;
      if (event.type === 'entry') {
        setEntries((current) => {
          const list = current?.repoPath === repoPath ? current.value : [];
          // Claude Code skriver ett fel både som svarstext och som resultat; visa det en gång
          const previous = list.at(-1);
          const duplicate =
            event.entry.kind === 'error' &&
            previous?.kind === 'assistant' &&
            previous.text === event.entry.text;
          return { repoPath, value: [...(duplicate ? list.slice(0, -1) : list), event.entry] };
        });
      } else {
        setState({ repoPath, value: event.state });
      }
    },
    [repoPath],
  );
  useIpcEvent(agentEvent, onEvent);

  const ask = useCallback(
    (prompt: string) => {
      if (!repoPath) return;
      setLastPrompt({ repoPath, value: prompt });
      invokeChannel(askAgentChannel, { repoPath, agent, prompt }).catch(console.error);
    },
    [repoPath, agent],
  );
  const stop = useCallback(() => {
    if (repoPath) invokeChannel(stopAgentChannel, { repoPath }).catch(console.error);
  }, [repoPath]);

  const api = useMemo(
    () => ({
      entries: entries?.repoPath === repoPath ? entries.value : [],
      state: state?.repoPath === repoPath ? state.value : 'stopped',
      lastPrompt: lastPrompt?.repoPath === repoPath ? lastPrompt.value : null,
      ask,
      stop,
    }),
    [entries, state, lastPrompt, repoPath, ask, stop],
  );
  return <AgentContext.Provider value={api}>{children}</AgentContext.Provider>;
}
