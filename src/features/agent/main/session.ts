import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { t } from '@/common/model/i18n';
import { type AgentSettings } from '@/common/model/agent';
import {
  type AgentEntry,
  type AgentRunner,
  type AgentState,
  type LaunchInput,
} from '../model/protocol';
import { agentEnv } from './env';
import { agentExecutable } from './executable';

const DEFAULT_SETTINGS: AgentSettings = { permission: 'auto', model: 'default', effort: 'default' };

function key(settings: AgentSettings): string {
  return `${settings.permission}|${settings.model}|${settings.effort}`;
}

export interface SessionEvents {
  onEntry: (entry: AgentEntry) => void;
  onState: (state: AgentState) => void;
  onThread?: (id: string) => void;
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
  private threadId: string | null;
  /** Inställningarna processen startades med. Ändras de startas processen om. */
  private activeSettings: string | null = null;
  /** Om ett avslut redan rapporterats för pågående process, så exit inte dubblar */
  private finished = false;

  constructor(
    private readonly repoPath: string,
    private readonly runner: AgentRunner,
    private readonly context: LaunchContext,
    private readonly events: SessionEvents,
    threadId: string | null = null,
  ) {
    this.threadId = threadId;
  }

  /**
   * Skickar frågan. `hint` följer med till agenten men visas inte i panelen,
   * t.ex. en påminnelse om att leverera i appen.
   */
  ask(prompt: string, settings: AgentSettings = DEFAULT_SETTINGS, hint?: string): void {
    this.emit({ at: now(), kind: 'user', text: prompt });
    const text = hint ? `${prompt}\n\n${hint}` : prompt;
    if (this.runner.persistent && this.child && this.activeSettings === key(settings)) {
      this.setState('busy');
      this.child.stdin?.write(this.runner.message(text));
      return;
    }
    if (this.child) this.stop();
    this.start(text, settings);
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin?.end();
    child.kill();
    this.setState('stopped');
  }

  private start(prompt: string, settings: AgentSettings): void {
    let launch;
    try {
      launch = this.runner.launch({
        ...this.context(),
        prompt,
        threadId: this.threadId,
        ...settings,
      });
    } catch (error) {
      this.fail(error);
      return;
    }
    let child: ChildProcess;
    try {
      const env = { ...agentEnv(), ...launch.env };
      child = spawn(agentExecutable(launch.command, env), launch.args, {
        cwd: this.repoPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.fail(error);
      return;
    }
    this.child = child;
    this.activeSettings = key(settings);
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
      this.stderr = (this.stderr + chunk.toString()).slice(-64000);
    });
    child.on('exit', (code) => {
      if (this.child !== child) return;
      this.child = null;
      if (code !== 0 && code !== null) {
        const lines = this.stderr
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const detail = lines.find((line) => /^error:/i.test(line)) ?? lines.at(-1) ?? '';
        this.emit({ at: now(), kind: 'error', text: t('agent.exited', { code, detail }) });
      }
      // En process per fråga avslutas när svaret är klart; det är inte ett stopp
      this.setState(this.runner.persistent || !this.finished ? 'stopped' : 'idle');
    });
    if (launch.stdin !== undefined && child.stdin) child.stdin.write(launch.stdin);
    if (!this.runner.persistent) child.stdin?.end();
  }

  /**
   * Mer från agenten efter att turen verkat klar, t.ex. från en underagent den
   * startat i bakgrunden: den arbetar fortfarande.
   */
  private resume(): void {
    if (this.state === 'idle' && this.child) this.setState('busy');
  }

  private onLine(line: string): void {
    for (const output of this.runner.parse(line)) {
      switch (output.type) {
        case 'text':
          this.resume();
          this.emit({ at: now(), kind: 'assistant', text: output.text });
          break;
        case 'tool':
          this.resume();
          this.emit({ at: now(), kind: 'tool', name: output.name });
          break;
        case 'thread':
          this.threadId = output.id;
          this.events.onThread?.(output.id);
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
