import { createContext, useContext } from 'react';
import { type AgentKind, type AgentPermission, type RunnableAgent } from '@/common/model/agent';

/** Delat mellan guiden, Anslut-panelen och agentpanelen: vald agent, läge och modell. */
export interface SetupApi {
  agent: AgentKind;
  setAgent: (agent: AgentKind) => void;
  /** Auto eller Manual, gemensamt för agenterna */
  permission: AgentPermission;
  setPermission: (permission: AgentPermission) => void;
  /** Vald modell per agent, `default` låter agenten välja */
  models: Readonly<Record<RunnableAgent, string>>;
  setModel: (agent: RunnableAgent, model: string) => void;
  /** Vald effort per agent, `default` låter agenten välja */
  efforts: Readonly<Record<RunnableAgent, string>>;
  setEffort: (agent: RunnableAgent, effort: string) => void;
  /** Guiden visas tills användaren stängt den, och igen på begäran */
  guideOpen: boolean;
  showGuide: () => void;
  dismissGuide: () => void;
}

const noop = (): void => undefined;

export const SetupContext = createContext<SetupApi>({
  agent: 'claude',
  setAgent: noop,
  permission: 'edits',
  setPermission: noop,
  models: { claude: 'default', codex: 'default' },
  setModel: noop,
  efforts: { claude: 'default', codex: 'default' },
  setEffort: noop,
  guideOpen: false,
  showGuide: noop,
  dismissGuide: noop,
});

export function useSetup(): SetupApi {
  return useContext(SetupContext);
}
