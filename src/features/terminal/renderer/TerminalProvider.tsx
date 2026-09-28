import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { readStored, useScopedKey, writeStored } from '@/common/renderer/storage';
import { subscribeEvent } from '@/common/renderer/ipc';
import { codexSessionEvent } from '../ipc/channels';
import { isCodexSessionId } from '../model/agent';
import { TerminalContext, type TerminalSender } from './TerminalContext';

/** Låter resten av appfliken skicka text till dess terminal utan att känna till panelen. */
export function TerminalProvider({
  children,
  tabId,
}: {
  children: ReactNode;
  tabId: number;
}): JSX.Element {
  const sessionStorageKey = useScopedKey('reverik.codexSessions');
  const sender = useRef<TerminalSender | null>(null);
  const queue = useRef<string[]>([]);

  const register = useCallback((next: TerminalSender | null) => {
    sender.current = next;
    if (next) {
      for (const line of queue.current) next(line);
      queue.current = [];
    }
  }, []);
  const send = useCallback((line: string) => {
    if (sender.current) sender.current(line);
    else queue.current.push(line);
  }, []);

  const codexSessionForRepo = useCallback(
    (repoPath: string): string | null => {
      try {
        const stored: unknown = JSON.parse(readStored(sessionStorageKey) ?? '{}');
        if (typeof stored !== 'object' || stored === null) return null;
        const sessionId = (stored as Record<string, unknown>)[repoPath];
        return isCodexSessionId(sessionId) ? sessionId : null;
      } catch {
        return null;
      }
    },
    [sessionStorageKey],
  );
  const rememberCodexSession = useCallback(
    (repoPath: string, sessionId: string) => {
      try {
        const stored: unknown = JSON.parse(readStored(sessionStorageKey) ?? '{}');
        const sessions =
          typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
        writeStored(sessionStorageKey, JSON.stringify({ ...sessions, [repoPath]: sessionId }));
      } catch {
        writeStored(sessionStorageKey, JSON.stringify({ [repoPath]: sessionId }));
      }
    },
    [sessionStorageKey],
  );

  useEffect(
    () =>
      subscribeEvent(codexSessionEvent, ({ tabId: sessionTabId, repoPath, sessionId }) => {
        if (sessionTabId === tabId) rememberCodexSession(repoPath, sessionId);
      }),
    [tabId, rememberCodexSession],
  );

  const api = useMemo(
    () => ({ tabId, send, register, codexSessionForRepo, rememberCodexSession }),
    [tabId, send, register, codexSessionForRepo, rememberCodexSession],
  );
  return <TerminalContext.Provider value={api}>{children}</TerminalContext.Provider>;
}
