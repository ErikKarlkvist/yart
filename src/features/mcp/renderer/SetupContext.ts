import { createContext, useContext } from 'react';
import { type AgentKind } from '../model/agents';

/** Delat mellan guiden och Anslut-panelen: vald agent och om guiden är öppen. */
export interface SetupApi {
  agent: AgentKind;
  setAgent: (agent: AgentKind) => void;
  /** Guiden visas tills användaren stängt den, och igen på begäran */
  guideOpen: boolean;
  showGuide: () => void;
  dismissGuide: () => void;
}

const noop = (): void => undefined;

export const SetupContext = createContext<SetupApi>({
  agent: 'claude',
  setAgent: noop,
  guideOpen: false,
  showGuide: noop,
  dismissGuide: noop,
});

export function useSetup(): SetupApi {
  return useContext(SetupContext);
}
