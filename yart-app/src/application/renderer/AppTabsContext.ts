import { createContext, useContext, useEffect } from 'react';

export interface TabTitleApi {
  setTitle: (title: string | null) => void;
}

export const AppTabsContext = createContext<TabTitleApi | null>(null);

/** Låter skalet i en flik berätta vad fliken ska heta. */
export function useTabTitle(title: string | null): void {
  const api = useContext(AppTabsContext);
  useEffect(() => {
    api?.setTitle(title);
  }, [api, title]);
}
