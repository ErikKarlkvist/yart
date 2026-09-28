import { useCallback, useEffect, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { checkAgentChannel } from '../ipc/channels';
import { type AgentCheck } from '../model/protocol';

export interface AgentCheckState {
  /** null tills första kontrollen svarat */
  check: AgentCheck | null;
  refresh: () => void;
}

/** Kör kontrollen av Claude Code när komponenten monteras, och igen på begäran. */
export function useAgentCheck(): AgentCheckState {
  const [check, setCheck] = useState<AgentCheck | null>(null);
  const refresh = useCallback(() => {
    invokeChannel(checkAgentChannel, undefined).then(setCheck).catch(console.error);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { check, refresh };
}
