import { type JSX } from 'react';
import { DockProvider } from '@/features/layout';
import { Onboarding, SetupProvider } from '@/features/mcp';
import { AppTabs } from './AppTabs';
import { DEFAULT_LAYOUT } from './panels';

export function App(): JSX.Element {
  return (
    <SetupProvider>
      <DockProvider defaults={DEFAULT_LAYOUT} storageKey="reverik.layout">
        <AppTabs />
      </DockProvider>
      <Onboarding />
    </SetupProvider>
  );
}
