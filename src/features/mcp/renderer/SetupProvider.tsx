import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import { useStoredChoice } from '@/common/renderer/useStored';
import { ACCESS_MODES, AGENT_KINDS, APPROVAL_POLICIES } from '@/common/model/agent';
import { SetupContext } from './SetupContext';

/** Globala för appen, inte per flik: guiden ska bara behöva stängas en gång. */
const ONBOARDED_KEY = 'reverik.onboarded';
const AGENT_KEY = 'reverik.agent';
const APPROVAL_KEY = 'reverik.approvalPolicy';
const CLAUDE_ACCESS_KEY = 'reverik.claudeAccessMode';
const CODEX_ACCESS_KEY = 'reverik.codexAccessMode';

export function SetupProvider({ children }: { children: ReactNode }): JSX.Element {
  const [guideOpen, setGuideOpen] = useState(() => readStored(ONBOARDED_KEY) !== 'true');
  const [agent, setAgent] = useStoredChoice(AGENT_KEY, AGENT_KINDS, 'claude');
  const [approvalPolicy, setApprovalPolicy] = useStoredChoice(
    APPROVAL_KEY,
    APPROVAL_POLICIES,
    'never',
  );
  const [claudeAccess, setClaudeAccess] = useStoredChoice(
    CLAUDE_ACCESS_KEY,
    ACCESS_MODES,
    'read-only',
  );
  const [codexAccess, setCodexAccess] = useStoredChoice(
    CODEX_ACCESS_KEY,
    ACCESS_MODES,
    'read-only',
  );
  const api = useMemo(
    () => ({
      agent,
      setAgent,
      approvalPolicy,
      setApprovalPolicy,
      accessModes: { claude: claudeAccess, codex: codexAccess },
      setAccessMode: (target: 'claude' | 'codex', mode: 'read-only' | 'workspace-write') => {
        if (target === 'claude') setClaudeAccess(mode);
        else setCodexAccess(mode);
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
      approvalPolicy,
      setApprovalPolicy,
      claudeAccess,
      codexAccess,
      setClaudeAccess,
      setCodexAccess,
      guideOpen,
    ],
  );
  return <SetupContext.Provider value={api}>{children}</SetupContext.Provider>;
}
