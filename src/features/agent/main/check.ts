import { execFile } from 'node:child_process';
import { type AgentCheck } from '../model/protocol';
import { agentEnv } from './env';

const TIMEOUT_MS = 15000;

function run(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, { env: agentEnv(), timeout: TIMEOUT_MS }, (error, stdout) => {
      resolve(error ? null : stdout);
    });
  });
}

/** Finns Claude Code på PATH, och är den inloggad? Frågar CLI:n själv. */
export async function checkClaude(): Promise<AgentCheck> {
  const version = await run('claude', ['--version']);
  if (version === null) return { installed: false, version: null, loggedIn: false };
  const status = await run('claude', ['auth', 'status']);
  return {
    installed: true,
    version: version.trim().split(' ')[0] ?? null,
    loggedIn: parseLoggedIn(status),
  };
}

function parseLoggedIn(status: string | null): boolean {
  try {
    return (JSON.parse(status ?? '{}') as { loggedIn?: unknown }).loggedIn === true;
  } catch {
    return false;
  }
}
