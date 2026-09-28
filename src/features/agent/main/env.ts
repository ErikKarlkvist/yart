import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/**
 * Miljön agentprocesser startas med. En app startad från Finder ärver en
 * mager PATH utan Homebrew, så de vanliga platserna läggs till. Variabeln
 * Claude Code sätter för att hindra nästlade sessioner tas bort.
 */
export function agentEnv(): NodeJS.ProcessEnv {
  const { CLAUDECODE: _nested, ...env } = process.env;
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin')];
  const current = (env.PATH ?? '').split(delimiter).filter(Boolean);
  env.PATH = [...current, ...extra.filter((dir) => !current.includes(dir))].join(delimiter);
  return env;
}
