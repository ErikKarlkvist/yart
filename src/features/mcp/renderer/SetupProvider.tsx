import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import { useStoredChoice, useStoredString } from '@/common/renderer/useStored';
import {
  AGENT_KINDS,
  AGENT_PERMISSIONS,
  type AgentPermission,
  DEFAULT_CHOICE,
  isSafeChoice,
  type RunnableAgent,
} from '@/common/model/agent';
import { SetupContext } from './SetupContext';

/** Globala för appen, inte per flik: guiden ska bara behöva stängas en gång. */
const ONBOARDED_KEY = 'reverik.onboarded';
const AGENT_KEY = 'reverik.agent';
const PERMISSION_KEY = 'reverik.agentPermission';
const CLAUDE_MODEL_KEY = 'reverik.claudeModel';
const CODEX_MODEL_KEY = 'reverik.codexModel';
const CLAUDE_EFFORT_KEY = 'reverik.claudeEffort';
const CODEX_EFFORT_KEY = 'reverik.codexEffort';

export function SetupProvider({ children }: { children: ReactNode }): JSX.Element {
  const [guideOpen, setGuideOpen] = useState(() => readStored(ONBOARDED_KEY) !== 'true');
  const [agent, setAgent] = useStoredChoice(AGENT_KEY, AGENT_KINDS, 'claude');
  const [permission, setPermission] = useStoredChoice(PERMISSION_KEY, AGENT_PERMISSIONS, 'auto');
  // Modellerna kommer från agenten själv, så lagringen tar vilket säkert värde som helst
  const [claudeModel, setClaudeModel] = useStoredString(
    CLAUDE_MODEL_KEY,
    DEFAULT_CHOICE,
    isSafeChoice,
  );
  const [codexModel, setCodexModel] = useStoredString(
    CODEX_MODEL_KEY,
    DEFAULT_CHOICE,
    isSafeChoice,
  );
  const [claudeEffort, setClaudeEffort] = useStoredString(
    CLAUDE_EFFORT_KEY,
    DEFAULT_CHOICE,
    isSafeChoice,
  );
  const [codexEffort, setCodexEffort] = useStoredString(
    CODEX_EFFORT_KEY,
    DEFAULT_CHOICE,
    isSafeChoice,
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
      efforts: { claude: claudeEffort, codex: codexEffort },
      setEffort: (target: RunnableAgent, effort: string) => {
        if (target === 'claude') setClaudeEffort(effort);
        else setCodexEffort(effort);
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
      claudeEffort,
      codexEffort,
      setClaudeEffort,
      setCodexEffort,
      guideOpen,
    ],
  );
  return <SetupContext.Provider value={api}>{children}</SetupContext.Provider>;
}
