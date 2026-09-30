import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { type AgentModel, type RunnableAgent } from '@/common/model/agent';
import { CLAUDE_INITIALIZE, parseClaudeModels } from '../model/models';
import { agentEnv } from './env';
import { agentExecutable } from './executable';

const TIMEOUT_MS = 15000;

/** Svaren sparas under appens livstid, listan ändras sällan */
const cache = new Map<RunnableAgent, AgentModel[]>();

/**
 * Modellerna den installerade agenten själv säger att den har. Tom lista om
 * agenten inte kan svara, då finns bara agentens standardval.
 */
export async function listModels(agent: RunnableAgent): Promise<AgentModel[]> {
  const cached = cache.get(agent);
  if (cached) return cached;
  // Codex saknar ett sätt att lista modeller utan att köra en fråga
  const models = agent === 'claude' ? await askClaude() : [];
  if (models.length > 0) cache.set(agent, models);
  return models;
}

/** Startar en Claude Code-process utan MCP-servrar, frågar och avslutar den. */
function askClaude(): Promise<AgentModel[]> {
  return new Promise((resolve) => {
    const env = agentEnv();
    let done = false;
    const finish = (models: AgentModel[]): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve(models);
    };
    const child = spawn(
      agentExecutable('claude', env),
      [
        '-p',
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        '--verbose',
        '--strict-mcp-config',
        '--mcp-config',
        JSON.stringify({ mcpServers: {} }),
      ],
      { env, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    const timer = setTimeout(() => {
      finish([]);
    }, TIMEOUT_MS);
    child.on('error', () => {
      finish([]);
    });
    child.on('exit', () => {
      finish([]);
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      const models = parseClaudeModels(line);
      if (models) finish(models);
    });
    child.stdin.write(CLAUDE_INITIALIZE);
  });
}
