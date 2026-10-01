import { useEffect, useState } from 'react';
import { type AgentModel, type RunnableAgent } from '@/common/model/agent';
import { invokeChannel } from '@/common/renderer/ipc';
import { listModelsChannel } from '../ipc/channels';

/**
 * Modellerna den installerade agenten har. Tom lista tills svaret kommit,
 * och om agenten inte kan svara; då finns bara agentens standardval.
 */
export function useAgentModels(agent: RunnableAgent | null): AgentModel[] {
  const [result, setResult] = useState<{ agent: RunnableAgent; models: AgentModel[] } | null>(null);
  useEffect(() => {
    if (agent === null) return;
    let cancelled = false;
    invokeChannel(listModelsChannel, { agent })
      .then((models) => {
        if (!cancelled) setResult({ agent, models });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [agent]);
  return result?.agent === agent ? result.models : [];
}
