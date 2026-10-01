import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { type AgentModel, type RunnableAgent } from '@/common/model/agent';
import { asRecord } from '@/common/model/json';
import { CLAUDE_INITIALIZE, parseClaudeModels, parseCodexModels } from '../model/models';
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
  const models = agent === 'claude' ? await askClaude() : await askCodex();
  if (models.length > 0) cache.set(agent, models);
  return models;
}

/** Hämtar modellistan via app-server utan att starta en modellfråga. */
function askCodex(): Promise<AgentModel[]> {
  return new Promise((resolve) => {
    const env = agentEnv();
    const child = spawn(agentExecutable('codex', env), ['app-server'], {
      env,
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const reader = createInterface({ input: child.stdout });
    let done = false;
    const models: AgentModel[] = [];
    const cursors = new Set<string>();
    const finish = (result: AgentModel[]): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reader.close();
      child.kill();
      resolve(result);
    };
    const timer = setTimeout(() => {
      finish([]);
    }, TIMEOUT_MS);
    const send = (message: unknown): void => {
      if (!done) child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    child.on('error', () => {
      finish([]);
    });
    child.on('exit', () => {
      finish([]);
    });
    child.stdin.on('error', () => {
      finish([]);
    });
    reader.on('line', (line) => {
      let message: Record<string, unknown>;
      try {
        message = asRecord(JSON.parse(line));
      } catch {
        return;
      }
      if (message.id !== 'yart-initialize' && message.id !== 'yart-models') return;
      if (message.error) {
        finish([]);
        return;
      }
      if (message.id === 'yart-initialize') {
        send({ method: 'initialized' });
        send({ id: 'yart-models', method: 'model/list', params: { includeHidden: false } });
        return;
      }
      const page = parseCodexModels(message);
      if (!page) {
        finish([]);
        return;
      }
      models.push(...page.models);
      if (page.nextCursor === null) {
        finish([...new Map(models.map((model) => [model.value, model])).values()]);
      } else if (cursors.has(page.nextCursor)) {
        finish([]);
      } else {
        cursors.add(page.nextCursor);
        send({
          id: 'yart-models',
          method: 'model/list',
          params: { includeHidden: false, cursor: page.nextCursor },
        });
      }
    });
    send({
      id: 'yart-initialize',
      method: 'initialize',
      params: { clientInfo: { name: 'yart', version: '0.1.0' } },
    });
  });
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
