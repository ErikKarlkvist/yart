import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { t } from '@/common/model/i18n';
import {
  type AgentEntry,
  type AgentRunner,
  type AgentState,
  type LaunchInput,
} from '../model/protocol';
import { agentEnv } from './env';

export interface SessionEvents {
  onEntry: (entry: AgentEntry) => void;
  onState: (state: AgentState) => void;
}

/** Adressen och skillen, hämtade när processen ska startas. */
export type LaunchContext = () => Pick<LaunchInput, 'mcpUrl' | 'skill'>;

/**
 * En agentsession för ett repo. Med en persistent runner startas processen
 * vid första frågan och tar fler på stdin. Annars startas en process per
 * fråga som fortsätter tråden från förra. Dör processen startar nästa fråga
 * om den, och tråden behålls.
 */
export class AgentSession {
  private child: ChildProcess | null = null;
  private state: AgentState = 'idle';
  private stderr = '';
  private threadId: string | null = null;
  /** Om ett avslut redan rapporterats för pågående process, så exit inte dubblar */
  private finished = false;

  constructor(
    private readonly repoPath: string,
    private readonly runner: AgentRunner,
    private readonly context: LaunchContext,
    private readonly events: SessionEvents,
  ) {}

  ask(prompt: string): void {
    this.emit({ at: now(), kind: 'user', text: prompt });
    if (this.runner.persistent && this.child) {
      this.setState('busy');
      this.child.stdin?.write(this.runner.message(prompt));
      return;
    }
    if (this.child) this.stop();
    this.start(prompt);
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin?.end();
    child.kill();
    this.setState('stopped');
  }

  private start(prompt: string): void {
    let launch;
    try {
      launch = this.runner.launch({ ...this.context(), prompt, threadId: this.threadId });
    } catch (error) {
      this.fail(error);
      return;
    }
    let child: ChildProcess;
    try {
      child = spawn(launch.command, launch.args, {
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
    this.finished = false;
    this.setState('busy');
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
      // En process per fråga avslutas när svaret är klart; det är inte ett stopp
      this.setState(this.runner.persistent || !this.finished ? 'stopped' : 'idle');
    });
    if (launch.stdin !== undefined && child.stdin) child.stdin.write(launch.stdin);
    if (!this.runner.persistent) child.stdin?.end();
  }

  private onLine(line: string): void {
    for (const output of this.runner.parse(line)) {
      switch (output.type) {
        case 'text':
          this.emit({ at: now(), kind: 'assistant', text: output.text });
          break;
        case 'tool':
          this.emit({ at: now(), kind: 'tool', name: output.name });
          break;
        case 'thread':
          this.threadId = output.id;
          break;
        case 'done':
          if (output.error !== null) this.emit({ at: now(), kind: 'error', text: output.error });
          this.finished = true;
          if (this.runner.persistent) this.setState('idle');
          break;
      }
    }
  }

  private fail(error: unknown): void {
    const code = (error as NodeJS.ErrnoException).code;
    const text =
      code === 'ENOENT'
        ? t('agent.notFound', { command: this.runner.kind })
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
