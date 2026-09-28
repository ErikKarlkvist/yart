import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type AgentEntry,
  type AgentRunner,
  type AgentState,
  claudeRunner,
  codexRunner,
} from '../model/protocol';
import { AgentSession } from './session';

/**
 * Låtsas-CLI:er som talar samma protokoll som de riktiga. Claude-varianten
 * läser frågor på stdin som stream-json och svarar per fråga; "die" avslutar
 * med kod 2. Codex-varianten tar frågan som argument, skriver JSONL och
 * avslutas; vid resume ekar den tråd-id:t den fick.
 */
const FAKE_CLAUDE = `
const rl = require('node:readline').createInterface({ input: process.stdin });
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
out({ type: 'system', subtype: 'init' });
rl.on('line', (line) => {
  const text = JSON.parse(line).message.content;
  if (text === 'die') { process.stderr.write('boom\\n'); process.exit(2); }
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__reverik__save_flow', input: {} }] } });
  out({ type: 'assistant', message: { content: [{ type: 'text', text: 'Reply to ' + text }] } });
  if (text === 'fail') out({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate' });
  else out({ type: 'result', subtype: 'success' });
});
`;
const FAKE_CODEX = `
const args = process.argv.slice(2);
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const resume = args[1] === 'resume';
const prompt = args[args.length - 1];
const thread = resume ? args[args.length - 2] : 'thread-1';
out({ type: 'thread.started', thread_id: thread });
out({ type: 'item.started', item: { type: 'mcp_tool_call', server: 'reverik', tool: 'save_flow' } });
out({ type: 'item.completed', item: { type: 'agent_message', text: (resume ? 'Resumed ' + thread + ': ' : 'Reply to ') + prompt.split('---').pop().trim() } });
out({ type: 'turn.completed', usage: {} });
`;

let claudeScript: string;
let codexScript: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reverik-agent-'));
  claudeScript = join(dir, 'fake-claude.cjs');
  codexScript = join(dir, 'fake-codex.cjs');
  await writeFile(claudeScript, FAKE_CLAUDE);
  await writeFile(codexScript, FAKE_CODEX);
});

/** Samma runner men med låtsas-CLI:n som kommando. */
function fake(runner: AgentRunner, script: string): AgentRunner {
  return {
    ...runner,
    launch: (input) => {
      const launch = runner.launch(input);
      return { ...launch, command: process.execPath, args: [script, ...launch.args] };
    },
  };
}

const context = (): { mcpUrl: string; skill: string } => ({
  mcpUrl: 'http://127.0.0.1:1/mcp',
  skill: 'SKILL',
});

function collect(): {
  entries: AgentEntry[];
  states: AgentState[];
  until: (predicate: () => boolean) => Promise<void>;
  events: { onEntry: (e: AgentEntry) => void; onState: (s: AgentState) => void };
} {
  const entries: AgentEntry[] = [];
  const states: AgentState[] = [];
  const waiters: (() => void)[] = [];
  const poke = (): void => {
    for (const waiter of waiters.splice(0)) waiter();
  };
  return {
    entries,
    states,
    until: (predicate) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`timeout: ${JSON.stringify({ entries, states })}`));
        }, 5000);
        const check = (): void => {
          if (predicate()) {
            clearTimeout(timer);
            resolve();
          } else waiters.push(check);
        };
        check();
      }),
    events: {
      onEntry: (e) => {
        entries.push(e);
        poke();
      },
      onState: (s) => {
        states.push(s);
        poke();
      },
    },
  };
}

describe('AgentSession med Claude Code', () => {
  it('startar processen, skickar frågan och tar emot verktyg, text och klart', async () => {
    const c = collect();
    const session = new AgentSession(tmpdir(), fake(claudeRunner, claudeScript), context, c.events);
    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.map((e) => e.kind)).toEqual(['user', 'tool', 'assistant']);
    expect(c.entries[2]).toMatchObject({ kind: 'assistant', text: 'Reply to hello' });
    expect(c.states).toEqual(['busy', 'idle']);

    // Andra frågan går till samma process
    session.ask('again');
    await c.until(() => c.entries.filter((e) => e.kind === 'assistant').length === 2);
    session.stop();
    expect(c.states.at(-1)).toBe('stopped');
  });

  it('visar agentens fel när svaret misslyckas', async () => {
    const c = collect();
    const session = new AgentSession(tmpdir(), fake(claudeRunner, claudeScript), context, c.events);
    session.ask('fail');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.at(-1)).toMatchObject({ kind: 'error', text: 'Failed to authenticate' });
    session.stop();
  });

  it('rapporterar när processen dör och startar om vid nästa fråga', async () => {
    const c = collect();
    const session = new AgentSession(tmpdir(), fake(claudeRunner, claudeScript), context, c.events);
    session.ask('die');
    await c.until(() => c.states.at(-1) === 'stopped');
    expect((c.entries.at(-1) as { text: string }).text).toContain('boom');

    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.at(-1)).toMatchObject({ kind: 'assistant', text: 'Reply to hello' });
    session.stop();
  });

  it('säger att kommandot saknas när det inte finns', async () => {
    const c = collect();
    const missing: AgentRunner = {
      ...claudeRunner,
      launch: () => ({ command: '/nonexistent/claude', args: [] }),
    };
    const session = new AgentSession(tmpdir(), missing, context, c.events);
    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'failed');
    expect((c.entries.at(-1) as { text: string }).text).toContain('claude');
  });
});

describe('AgentSession med Codex', () => {
  it('kör en process per fråga och fortsätter tråden', async () => {
    const c = collect();
    const session = new AgentSession(tmpdir(), fake(codexRunner, codexScript), context, c.events);
    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.map((e) => e.kind)).toEqual(['user', 'tool', 'assistant']);
    expect(c.entries[2]).toMatchObject({ kind: 'assistant', text: 'Reply to hello' });

    session.ask('more');
    await c.until(() => c.entries.filter((e) => e.kind === 'assistant').length === 2);
    expect(c.entries.at(-1)).toMatchObject({ kind: 'assistant', text: 'Resumed thread-1: more' });
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.states).toEqual(['busy', 'idle', 'busy', 'idle']);
  });
});
