import { type JSX } from 'react';
import { Onboarding, OnboardingProvider } from '@/features/mcp';
import { AppTabs } from './AppTabs';

export function App(): JSX.Element {
  return (
    <OnboardingProvider>
      <AppTabs />
      <Onboarding />
    </OnboardingProvider>
  );
}
