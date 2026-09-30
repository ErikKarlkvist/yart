import { createContext, useContext } from 'react';
import {
  type AccessMode,
  type AgentKind,
  type ApprovalPolicy,
  type RunnableAgent,
} from '@/common/model/agent';

/** Delat mellan guiden och Anslut-panelen: vald agent och om guiden är öppen. */
export interface SetupApi {
  agent: AgentKind;
  setAgent: (agent: AgentKind) => void;
  approvalPolicy: ApprovalPolicy;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
  accessModes: Readonly<Record<RunnableAgent, AccessMode>>;
  setAccessMode: (agent: RunnableAgent, mode: AccessMode) => void;
  /** Guiden visas tills användaren stängt den, och igen på begäran */
  guideOpen: boolean;
  showGuide: () => void;
  dismissGuide: () => void;
}

const noop = (): void => undefined;

export const SetupContext = createContext<SetupApi>({
  agent: 'claude',
  setAgent: noop,
  approvalPolicy: 'never',
  setApprovalPolicy: noop,
  accessModes: { claude: 'read-only', codex: 'read-only' },
  setAccessMode: noop,
  guideOpen: false,
  showGuide: noop,
  dismissGuide: noop,
});

export function useSetup(): SetupApi {
  return useContext(SetupContext);
}
