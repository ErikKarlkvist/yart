import { randomUUID } from 'node:crypto';
import { type IPty, spawn } from 'node-pty';
import { type TerminalSize } from '../ipc/channels';
import { snapshotCodexSessionFiles, waitForNewCodexSession } from './codexSessions';
import { codexShellCommand } from './codexCommand';
import { terminalShell } from './shell';

interface Listeners {
  onData: (id: string, data: string) => void;
  onExit: (id: string, exitCode: number) => void;
  onCodexSession: (tabId: number, repoPath: string, sessionId: string) => void;
}

interface CodexStart {
  id: string;
  repoPath: string;
  tabId: number;
  sessionId: string | null;
  prompt: string | null;
}

interface TerminalSession {
  pty: IPty;
  shellFile: string;
}

/**
 * Håller de skal som är igång. Ett skal per öppen terminalpanel. Skalet
 * startas på Unix som inloggningsskal så att PATH och verktyg som `claude` finns
 * även när appen startats från Finder.
 */
export class TerminalSessions {
  private readonly sessions = new Map<string, TerminalSession>();
  private readonly codexTrackers = new Map<string, AbortController>();
  private readonly codexStarted = new Set<string>();
  private codexStartQueue = Promise.resolve();

  constructor(private readonly listeners: Listeners) {}

  open(cwd: string, size: TerminalSize): string {
    const id = randomUUID();
    const shell = terminalShell(process.platform, process.env.SHELL);
    const pty = spawn(shell.file, shell.args, {
      name: 'xterm-256color',
      cwd,
      cols: size.cols,
      rows: size.rows,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
    this.sessions.set(id, { pty, shellFile: shell.file });
    pty.onData((data) => {
      this.listeners.onData(id, data);
    });
    pty.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.codexStarted.delete(id);
      this.codexTrackers.get(id)?.abort();
      this.codexTrackers.delete(id);
      this.listeners.onExit(id, exitCode);
    });
    return id;
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  startCodex({ id, repoPath, tabId, sessionId, prompt }: CodexStart): void {
    const session = this.sessions.get(id);
    if (!session || this.codexStarted.has(id)) return;
    const command = codexShellCommand(session.shellFile, sessionId, prompt);
    if (!command) return;
    this.codexStarted.add(id);

    if (sessionId) {
      session.pty.write(`${command}\r`);
      return;
    }

    const start = async (): Promise<void> => {
      if (!this.sessions.has(id)) return;
      const knownFiles = await snapshotCodexSessionFiles();
      const liveSession = this.sessions.get(id);
      if (!liveSession) return;
      const controller = new AbortController();
      this.codexTrackers.set(id, controller);
      liveSession.pty.write(`${command}\r`);
      try {
        const createdSession = await waitForNewCodexSession(
          knownFiles,
          repoPath,
          15_000,
          controller.signal,
        );
        if (createdSession) this.listeners.onCodexSession(tabId, repoPath, createdSession);
      } finally {
        this.codexTrackers.delete(id);
      }
    };

    const queued = this.codexStartQueue.then(start);
    this.codexStartQueue = queued.catch((error: unknown) => {
      console.error('Could not start or track Codex session', error);
    });
  }

  resize(id: string, size: TerminalSize): void {
    if (size.cols < 1 || size.rows < 1) return;
    this.sessions.get(id)?.pty.resize(size.cols, size.rows);
  }

  close(id: string): void {
    this.codexTrackers.get(id)?.abort();
    this.codexTrackers.delete(id);
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    this.codexStarted.delete(id);
    session.pty.kill();
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }
}
