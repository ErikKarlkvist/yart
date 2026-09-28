import { useCallback, useEffect, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { useIpcEvent } from '@/common/renderer/useIpcEvent';
import {
  installSkillChannel,
  mcpActivityEvent,
  mcpStatusChannel,
  skillTextChannel,
} from '../ipc/channels';
import { type SkillTarget } from '../model/agents';
import { type McpStatus } from '../model/mcp';

export interface McpState {
  status: McpStatus | null;
  installSkill: (target: SkillTarget) => Promise<void>;
  /** Skillen som text, att klistra in hos en agent utan skillmapp */
  skillText: () => Promise<string>;
}

/** Serverns status, hämtad vid start och igen efter varje verktygsanrop. */
export function useMcpStatus(): McpState {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const refresh = useCallback(() => {
    invokeChannel(mcpStatusChannel, undefined).then(setStatus).catch(console.error);
  }, []);
  useEffect(() => {
    refresh();
    // Servern startar asynkront, så en tidig fråga kan sakna adress ännu
    const timer = setTimeout(refresh, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [refresh]);
  useIpcEvent(mcpActivityEvent, refresh);
  const installSkill = useCallback(async (target: SkillTarget) => {
    setStatus(await invokeChannel(installSkillChannel, { target }));
  }, []);
  const skillText = useCallback(() => invokeChannel(skillTextChannel, undefined), []);
  return { status, installSkill, skillText };
}
