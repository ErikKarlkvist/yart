import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { readStored, writeStored } from '@/common/renderer/storage';
import { OnboardingContext } from './OnboardingContext';

/** Global för appen, inte per flik: guiden ska bara behöva stängas en gång. */
const ONBOARDED_KEY = 'reverik.onboarded';

export function OnboardingProvider({ children }: { children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(() => readStored(ONBOARDED_KEY) !== 'true');
  const api = useMemo(
    () => ({
      open,
      show: () => {
        setOpen(true);
      },
      dismiss: () => {
        writeStored(ONBOARDED_KEY, 'true');
        setOpen(false);
      },
    }),
    [open],
  );
  return <OnboardingContext.Provider value={api}>{children}</OnboardingContext.Provider>;
}
