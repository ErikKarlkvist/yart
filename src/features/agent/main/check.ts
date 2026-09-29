import { execFile } from 'node:child_process';
import { type RunnableAgent } from '@/common/model/agent';
import { type AgentCheck } from '../model/protocol';
import { agentEnv } from './env';

const TIMEOUT_MS = 15000;

interface Ran {
  ok: boolean;
  stdout: string;
}

function run(command: string, args: string[]): Promise<Ran | null> {
  return new Promise((resolve) => {
    execFile(command, args, { env: agentEnv(), timeout: TIMEOUT_MS }, (error, stdout) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === 'ENOENT') resolve(null);
      else resolve({ ok: !error, stdout });
    });
  });
}

/** Finns agenten på PATH, och är den inloggad? Frågar CLI:n själv. */
export async function checkAgent(agent: RunnableAgent): Promise<AgentCheck> {
  const version = await run(agent, ['--version']);
  if (!version?.ok) return { installed: false, version: null, loggedIn: false };
  const loggedIn =
    agent === 'claude'
      ? parseClaudeLoggedIn((await run('claude', ['auth', 'status']))?.stdout ?? null)
      : ((await run('codex', ['login', 'status']))?.ok ?? false);
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
