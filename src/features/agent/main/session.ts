import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { t } from '@/common/model/i18n';
import { agentEnv } from './env';
import {
  type AgentEntry,
  type AgentLaunch,
  type AgentState,
  parseAgentLine,
  userMessageLine,
} from '../model/protocol';

export interface SessionEvents {
  onEntry: (entry: AgentEntry) => void;
  onState: (state: AgentState) => void;
}

/**
 * En headless agentprocess för ett repo. Startas med första frågan, tar
 * emot fler frågor på stdin och rapporterar text, verktyg och fel från
 * stdout. Dör processen startar nästa fråga om den.
 */
export class AgentSession {
  private child: ChildProcess | null = null;
  private state: AgentState = 'idle';
  private stderr = '';

  constructor(
    private readonly repoPath: string,
    private readonly launch: () => AgentLaunch,
    private readonly events: SessionEvents,
  ) {}

  ask(prompt: string): void {
    this.emit({ at: now(), kind: 'user', text: prompt });
    if (!this.child) this.start();
    const child = this.child;
    if (!child?.stdin?.writable) return;
    this.setState('busy');
    child.stdin.write(userMessageLine(prompt));
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin?.end();
    child.kill();
    this.setState('stopped');
  }

  private start(): void {
    const { command, args } = this.launch();
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd: this.repoPath,
        env: agentEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.fail(error);
      return;
    }
    this.child = child;
    this.stderr = '';
    child.on('error', (error) => {
      if (this.child === child) this.child = null;
      this.fail(error);
    });
    if (child.stdout) {
      createInterface({ input: child.stdout }).on('line', (line) => {
        this.onLine(line);
      });
    }
    child.stderr?.on('data', (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-2000);
    });
    child.on('exit', (code) => {
      if (this.child !== child) return;
      this.child = null;
      if (code !== 0 && code !== null) {
        const detail = this.stderr.trim().split('\n').at(-1) ?? '';
        this.emit({ at: now(), kind: 'error', text: t('agent.exited', { code, detail }) });
      }
      this.setState('stopped');
    });
  }

  private onLine(line: string): void {
    for (const output of parseAgentLine(line)) {
      switch (output.type) {
        case 'text':
          this.emit({ at: now(), kind: 'assistant', text: output.text });
          break;
        case 'tool':
          this.emit({ at: now(), kind: 'tool', name: output.name });
          break;
        case 'done':
          if (output.error !== null) this.emit({ at: now(), kind: 'error', text: output.error });
          this.setState('idle');
          break;
        case 'ignore':
          break;
      }
    }
  }

  private fail(error: unknown): void {
    const code = (error as NodeJS.ErrnoException).code;
    const text =
      code === 'ENOENT'
        ? t('agent.notFound', { command: this.launch().command })
        : error instanceof Error
          ? error.message
          : String(error);
    this.emit({ at: now(), kind: 'error', text });
    this.setState('failed');
  }

  private setState(state: AgentState): void {
    if (this.state === state) return;
    this.state = state;
    this.events.onState(state);
  }

  private emit(entry: AgentEntry): void {
    this.events.onEntry(entry);
  }
}

function now(): string {
  return new Date().toISOString();
}
