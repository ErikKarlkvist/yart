import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import { useStoredChoice } from '@/common/renderer/useStored';
import {
  AGENT_KINDS,
  AGENT_MODELS,
  AGENT_PERMISSIONS,
  type AgentPermission,
  type RunnableAgent,
} from '@/common/model/agent';
import { SetupContext } from './SetupContext';

/** Globala för appen, inte per flik: guiden ska bara behöva stängas en gång. */
const ONBOARDED_KEY = 'reverik.onboarded';
const AGENT_KEY = 'reverik.agent';
const PERMISSION_KEY = 'reverik.agentPermission';
const CLAUDE_MODEL_KEY = 'reverik.claudeModel';
const CODEX_MODEL_KEY = 'reverik.codexModel';

export function SetupProvider({ children }: { children: ReactNode }): JSX.Element {
  const [guideOpen, setGuideOpen] = useState(() => readStored(ONBOARDED_KEY) !== 'true');
  const [agent, setAgent] = useStoredChoice(AGENT_KEY, AGENT_KINDS, 'claude');
  const [permission, setPermission] = useStoredChoice(PERMISSION_KEY, AGENT_PERMISSIONS, 'auto');
  const [claudeModel, setClaudeModel] = useStoredChoice(
    CLAUDE_MODEL_KEY,
    AGENT_MODELS.claude,
    'default',
  );
  const [codexModel, setCodexModel] = useStoredChoice(
    CODEX_MODEL_KEY,
    AGENT_MODELS.codex,
    'default',
  );
  const api = useMemo(
    () => ({
      agent,
      setAgent,
      permission,
      setPermission: (next: AgentPermission) => {
        setPermission(next);
      },
      models: { claude: claudeModel, codex: codexModel },
      setModel: (target: RunnableAgent, model: string) => {
        if (target === 'claude') setClaudeModel(model);
        else setCodexModel(model);
      },
      guideOpen,
      showGuide: () => {
        setGuideOpen(true);
      },
      dismissGuide: () => {
        writeStored(ONBOARDED_KEY, 'true');
        setGuideOpen(false);
      },
    }),
    [
      agent,
      setAgent,
      permission,
      setPermission,
      claudeModel,
      codexModel,
      setClaudeModel,
      setCodexModel,
      guideOpen,
    ],
  );
  return <SetupContext.Provider value={api}>{children}</SetupContext.Provider>;
}
