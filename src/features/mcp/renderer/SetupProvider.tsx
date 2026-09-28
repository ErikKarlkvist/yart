import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import { useStoredChoice } from '@/common/renderer/useStored';
import { AGENT_KINDS } from '../model/agents';
import { SetupContext } from './SetupContext';

/** Globala för appen, inte per flik: guiden ska bara behöva stängas en gång. */
const ONBOARDED_KEY = 'reverik.onboarded';
const AGENT_KEY = 'reverik.agent';

export function SetupProvider({ children }: { children: ReactNode }): JSX.Element {
  const [guideOpen, setGuideOpen] = useState(() => readStored(ONBOARDED_KEY) !== 'true');
  const [agent, setAgent] = useStoredChoice(AGENT_KEY, AGENT_KINDS, 'claude');
  const api = useMemo(
    () => ({
      agent,
      setAgent,
      guideOpen,
      showGuide: () => {
        setGuideOpen(true);
      },
      dismissGuide: () => {
        writeStored(ONBOARDED_KEY, 'true');
        setGuideOpen(false);
      },
    }),
    [agent, setAgent, guideOpen],
  );
  return <SetupContext.Provider value={api}>{children}</SetupContext.Provider>;
}
