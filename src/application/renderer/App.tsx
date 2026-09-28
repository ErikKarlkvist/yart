import { type JSX } from 'react';
import { Onboarding, SetupProvider } from '@/features/mcp';
import { AppTabs } from './AppTabs';

export function App(): JSX.Element {
  return (
    <SetupProvider>
      <AppTabs />
      <Onboarding />
    </SetupProvider>
  );
}
