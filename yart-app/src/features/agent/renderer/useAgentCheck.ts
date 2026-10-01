import { useCallback, useEffect, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { checkAgentChannel } from '../ipc/channels';
import { type RunnableAgent } from '@/common/model/agent';
import { type AgentCheck } from '../model/protocol';

export interface AgentCheckState {
  /** null tills första kontrollen svarat */
  check: AgentCheck | null;
  refresh: () => void;
}

/** Kontrollerar agenten när komponenten monteras och när agenten byts, och igen på begäran. */
export function useAgentCheck(agent: RunnableAgent): AgentCheckState {
  const [result, setResult] = useState<{ agent: RunnableAgent; check: AgentCheck } | null>(null);
  const refresh = useCallback(() => {
    invokeChannel(checkAgentChannel, { agent })
      .then((check) => {
        setResult({ agent, check });
      })
      .catch(console.error);
  }, [agent]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { check: result?.agent === agent ? result.check : null, refresh };
}
