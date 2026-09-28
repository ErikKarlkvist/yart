import { createContext, useContext } from 'react';

export type TerminalSender = (line: string) => void;

export interface TerminalApi {
  tabId: number;
  /** Skriver en rad till programmet i terminalen. Köas tills en terminal finns. */
  send: TerminalSender;
  /** Terminalpanelen registrerar sig här när skalet är igång, null när den stängs */
  register: (sender: TerminalSender | null) => void;
  /** Codex-sessionen sparas per repo i lagringsutrymmet för den aktuella fliken. */
  codexSessionForRepo: (repoPath: string) => string | null;
  rememberCodexSession: (repoPath: string, sessionId: string) => void;
}

export const TerminalContext = createContext<TerminalApi | null>(null);

export function useTerminalApi(): TerminalApi {
  const api = useContext(TerminalContext);
  if (!api) throw new Error('useTerminalApi must be used inside TerminalProvider');
  return api;
}
