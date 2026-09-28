import { defineChannel, defineEvent } from '@/common/ipc/channel';

export interface TerminalSize {
  cols: number;
  rows: number;
}

/** Startar ett skal i repots rot. Svarar med ett id som övriga kanaler använder. */
export const openTerminalChannel = defineChannel<
  { repoPath: string } & TerminalSize,
  { id: string }
>('terminal:open');

export const writeTerminalChannel = defineChannel<{ id: string; data: string }>('terminal:write');

/** Startar Codex och binder ett nyskapat samtal till rätt Reverik-flik. */
export const startCodexChannel = defineChannel<{
  id: string;
  command: string;
  repoPath: string;
  tabId: number;
  sessionId: string | null;
}>('terminal:start-codex');

export const resizeTerminalChannel = defineChannel<{ id: string } & TerminalSize>(
  'terminal:resize',
);

export const closeTerminalChannel = defineChannel<{ id: string }>('terminal:close');

/** Utdata från skalet, redan kodat för xterm. */
export const terminalDataEvent = defineEvent<{ id: string; data: string }>('terminal:data');

export const terminalExitEvent = defineEvent<{ id: string; exitCode: number }>('terminal:exit');

export const codexSessionEvent = defineEvent<{
  repoPath: string;
  sessionId: string;
  tabId: number;
}>('terminal:codex-session');
