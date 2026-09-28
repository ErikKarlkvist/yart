import { createContext, useContext } from 'react';

export interface OnboardingApi {
  /** Guiden visas tills användaren stängt den, och igen på begäran */
  open: boolean;
  show: () => void;
  dismiss: () => void;
}

const noop = (): void => undefined;

export const OnboardingContext = createContext<OnboardingApi>({
  open: false,
  show: noop,
  dismiss: noop,
});

export function useOnboarding(): OnboardingApi {
  return useContext(OnboardingContext);
}
