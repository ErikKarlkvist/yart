import { execFile } from 'node:child_process';
import { type RunnableAgent } from '@/common/model/agent';
import { type AgentCheck } from '../model/protocol';
import { agentEnv } from './env';
import { agentExecutable } from './executable';

const TIMEOUT_MS = 15000;

interface Ran {
  ok: boolean;
  stdout: string;
  error: string | null;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<Ran | null> {
  return new Promise((resolve) => {
    execFile(command, args, { env, timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === 'ENOENT') resolve(null);
      else resolve({ ok: !error, stdout, error: error ? stderr.trim() || error.message : null });
    });
  });
}

/** Finns agenten på PATH, och är den inloggad? Frågar CLI:n själv. */
export async function checkAgent(agent: RunnableAgent): Promise<AgentCheck> {
  const env = agentEnv();
  const command = agentExecutable(agent, env);
  const version = await run(command, ['--version'], env);
  if (version === null) return { installed: false, version: null, loggedIn: false };
  if (!version.ok)
    return {
      installed: true,
      version: null,
      loggedIn: false,
      error: version.error ?? 'Unknown error',
    };
  const loggedIn =
    agent === 'claude'
      ? parseClaudeLoggedIn((await run(command, ['auth', 'status'], env))?.stdout ?? null)
      : ((await run(command, ['login', 'status'], env))?.ok ?? false);
  return { installed: true, version: parseVersion(version.stdout), loggedIn };
}

/** `2.1.274 (Claude Code)` och `codex-cli 0.158.0` blir bara numret. */
function parseVersion(stdout: string): string | null {
  return /\d+\.\d+(?:\.\d+)?/.exec(stdout)?.[0] ?? null;
}

function parseClaudeLoggedIn(status: string | null): boolean {
  try {
    return (JSON.parse(status ?? '{}') as { loggedIn?: unknown }).loggedIn === true;
  } catch {
    return false;
  }
}
