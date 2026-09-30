import { createContext, useContext } from 'react';

export const WindowBarContext = createContext<HTMLElement | null>(null);

export function useWindowBar(): HTMLElement | null {
  return useContext(WindowBarContext);
}
