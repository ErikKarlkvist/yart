import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { type AgentEntry, type AgentState } from '../model/protocol';
import { AgentSession } from './session';

/**
 * En låtsas-CLI som talar samma protokoll som `claude -p` med stream-json:
 * läser användarrader på stdin och svarar med ett verktyg, en text och ett
 * resultat. Frågan "fail" ger ett felresultat, "die" avslutar med kod 2.
 */
const FAKE_CLI = `
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

let script: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reverik-agent-'));
  script = join(dir, 'fake-claude.cjs');
  await writeFile(script, FAKE_CLI);
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

describe('AgentSession', () => {
  it('startar processen, skickar frågan och tar emot verktyg, text och klart', async () => {
    const c = collect();
    const session = new AgentSession(
      tmpdir(),
      () => ({ command: process.execPath, args: [script] }),
      c.events,
    );
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
    const session = new AgentSession(
      tmpdir(),
      () => ({ command: process.execPath, args: [script] }),
      c.events,
    );
    session.ask('fail');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.at(-1)).toMatchObject({ kind: 'error', text: 'Failed to authenticate' });
    session.stop();
  });

  it('rapporterar när processen dör och startar om vid nästa fråga', async () => {
    const c = collect();
    const session = new AgentSession(
      tmpdir(),
      () => ({ command: process.execPath, args: [script] }),
      c.events,
    );
    session.ask('die');
    await c.until(() => c.states.at(-1) === 'stopped');
    expect(c.entries.at(-1)).toMatchObject({ kind: 'error' });
    expect((c.entries.at(-1) as { text: string }).text).toContain('boom');

    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'idle');
    expect(c.entries.at(-1)).toMatchObject({ kind: 'assistant', text: 'Reply to hello' });
    session.stop();
  });

  it('säger att kommandot saknas när det inte finns', async () => {
    const c = collect();
    const session = new AgentSession(
      tmpdir(),
      () => ({ command: '/nonexistent/claude', args: [] }),
      c.events,
    );
    session.ask('hello');
    await c.until(() => c.states.at(-1) === 'failed');
    expect((c.entries.at(-1) as { text: string }).text).toContain('/nonexistent/claude');
  });
});
