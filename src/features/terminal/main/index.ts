import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import {
  closeTerminalChannel,
  codexSessionEvent,
  openTerminalChannel,
  resizeTerminalChannel,
  startCodexChannel,
  terminalDataEvent,
  terminalExitEvent,
  writeTerminalChannel,
} from '../ipc/channels';
import { TerminalSessions } from './sessions';

export interface TerminalOptions {
  /** Körs innan skalet startar i ett repo, t.ex. för att se till att guiden agenten läser finns. */
  prepare?: (repoPath: string) => Promise<void>;
}

export function registerTerminalHandlers({ prepare }: TerminalOptions = {}): void {
  const sessions = new TerminalSessions({
    onData: (id, data) => {
      emitEvent(terminalDataEvent, { id, data });
    },
    onExit: (id, exitCode) => {
      emitEvent(terminalExitEvent, { id, exitCode });
    },
    onCodexSession: (tabId, repoPath, sessionId) => {
      emitEvent(codexSessionEvent, { tabId, repoPath, sessionId });
    },
  });

  handleChannel(openTerminalChannel, async ({ repoPath, cols, rows }) => {
    // Agenten startar direkt i skalet, så det som ska finnas i repot måste finnas nu.
    await prepare?.(repoPath).catch((error: unknown) => {
      console.error(error);
    });
    return { id: sessions.open(repoPath, { cols, rows }) };
  });
  handleChannel(writeTerminalChannel, ({ id, data }) => {
    sessions.write(id, data);
  });
  handleChannel(startCodexChannel, (request) => {
    sessions.startCodex(request);
  });
  handleChannel(resizeTerminalChannel, ({ id, cols, rows }) => {
    sessions.resize(id, { cols, rows });
  });
  handleChannel(closeTerminalChannel, ({ id }) => {
    sessions.close(id);
  });

  app.on('before-quit', () => {
    sessions.closeAll();
  });
}
