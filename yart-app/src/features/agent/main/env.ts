import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/**
 * Miljön agentprocesser startas med. En app startad från Finder ärver en
 * mager PATH utan Homebrew, så de vanliga platserna läggs till. Variabeln
 * Claude Code sätter för att hindra nästlade sessioner tas bort.
 */
export function agentEnv(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _nested, ...env } = process.env;
  return withAgentPath(env);
}

/** Windows commonly calls this variable `Path`; keep its original spelling. */
export function withAgentPath(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const entries = Object.entries(source);
  const pathEntries = entries.filter(([key]) => key.toLowerCase() === 'path');
  const pathKey = pathEntries[0]?.[0] ?? 'PATH';
  const current = pathEntries.flatMap(([, value]) =>
    (value ?? '').split(delimiter).filter(Boolean),
  );
  const extra =
    process.platform === 'win32'
      ? [
          join(source.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm'),
          join(homedir(), '.local', 'bin'),
        ]
      : ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin')];
  const samePath = (left: string, right: string): boolean =>
    process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
  const env = Object.fromEntries(entries.filter(([key]) => key.toLowerCase() !== 'path'));
  env[pathKey] = [
    ...current,
    ...extra.filter((dir) => !current.some((path) => samePath(path, dir))),
  ].join(delimiter);
  return env;
}
