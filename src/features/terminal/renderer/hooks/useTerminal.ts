import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { invokeChannel, subscribeEvent } from '@/common/renderer/ipc';
import { type Agent } from '../../model/agent';
import {
  closeTerminalChannel,
  openTerminalChannel,
  resizeTerminalChannel,
  startCodexChannel,
  terminalDataEvent,
  terminalExitEvent,
  writeTerminalChannel,
} from '../../ipc/channels';
import { useTerminalApi } from '../TerminalContext';
import { readTerminalTheme, watchTheme } from './terminalTheme';

interface Session {
  key: string;
  id: string;
  exitCode: number | null;
}

export interface TerminalState {
  /** null tills skalet startat, sedan avslutningskoden när det dött */
  exitCode: number | null;
  restart: () => void;
  /** Kör ett kommando i skalet, som om användaren skrivit det och tryckt Enter. */
  run: (command: string) => void;
  startCodex: (command: string, sessionId: string | null) => void;
}

/**
 * Äger xterm-instansen och skalet bakom den. Startar om när repot byts eller
 * `restart` anropas. Containern måste finnas när effekten körs. `startCommand`
 * skrivs in i skalet så fort det öppnats.
 */
export function useTerminal(
  repoPath: string,
  container: RefObject<HTMLDivElement | null>,
  agent: Agent,
  startCommand: string | null,
  codexSessionId: string | null,
): TerminalState {
  const [generation, setGeneration] = useState(0);
  // Taggas med nyckeln för aktuellt skal, så ett byte av repo eller omstart
  // ger nollställt tillstånd utan att effekten behöver sätta state direkt.
  const key = `${repoPath}#${generation}`;
  const [session, setSession] = useState<Session | null>(null);
  const live = session?.key === key ? session : null;
  const exitCode = live?.exitCode ?? null;
  const sessionId = live?.id ?? null;
  const { register, tabId } = useTerminalApi();

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let id: string | null = null;
    let disposed = false;

    const term = new Terminal({
      fontFamily: '"SF Mono", Menlo, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.2,
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 5000,
      theme: readTerminalTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(element);
    fit.fit();

    void invokeChannel(openTerminalChannel, {
      repoPath,
      cols: term.cols,
      rows: term.rows,
    }).then(({ id: opened }) => {
      if (disposed) {
        void invokeChannel(closeTerminalChannel, { id: opened });
        return;
      }
      id = opened;
      setSession({ key, id: opened, exitCode: null });
      term.focus();
      // Skalet läser det köade när det är redo, så kommandot kan skickas direkt.
      if (startCommand) {
        if (agent === 'codex') {
          void invokeChannel(startCodexChannel, {
            id: opened,
            command: startCommand,
            repoPath,
            tabId,
            sessionId: codexSessionId,
          });
        } else {
          void invokeChannel(writeTerminalChannel, { id: opened, data: `${startCommand}\r` });
        }
      }
      register((text) => {
        // Flera rader skickas som bracketed paste så TUI:n inte skickar iväg vid första radbrytningen
        const data = text.includes('\n') ? `\u001b[200~${text}\u001b[201~\r` : `${text}\r`;
        void invokeChannel(writeTerminalChannel, { id: opened, data });
      });
    });

    const disposables = [
      term.onData((data) => {
        if (id) void invokeChannel(writeTerminalChannel, { id, data });
      }),
      term.onResize(({ cols, rows }) => {
        if (id) void invokeChannel(resizeTerminalChannel, { id, cols, rows });
      }),
    ];
    const unsubscribe = [
      subscribeEvent(terminalDataEvent, (event) => {
        if (event.id === id) term.write(event.data);
      }),
      subscribeEvent(terminalExitEvent, (event) => {
        if (event.id === id) setSession({ key, id, exitCode: event.exitCode });
      }),
      watchTheme(() => {
        term.options.theme = readTerminalTheme();
      }),
    ];
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0 && element.clientHeight > 0) fit.fit();
    });
    observer.observe(element);

    return () => {
      disposed = true;
      register(null);
      observer.disconnect();
      for (const off of unsubscribe) off();
      for (const d of disposables) d.dispose();
      term.dispose();
      if (id) void invokeChannel(closeTerminalChannel, { id });
    };
  }, [repoPath, key, container, agent, startCommand, codexSessionId, register, tabId]);

  const restart = useCallback(() => {
    setGeneration((g) => g + 1);
  }, []);

  const run = useCallback(
    (command: string) => {
      if (sessionId)
        void invokeChannel(writeTerminalChannel, { id: sessionId, data: `${command}\r` });
    },
    [sessionId],
  );

  const startCodex = useCallback(
    (command: string, sessionId: string | null) => {
      const currentId = session?.key === key ? session.id : null;
      if (!currentId) return;
      void invokeChannel(startCodexChannel, {
        id: currentId,
        command,
        repoPath,
        tabId,
        sessionId,
      });
    },
    [key, repoPath, session, tabId],
  );

  return { exitCode, restart, run, startCodex };
}
