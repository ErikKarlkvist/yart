import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('./executable', () => ({ agentExecutable: () => 'codex' }));

function fakeProcess(): EventEmitter & {
  stdin: PassThrough;
  stdout: PassThrough;
  kill: ReturnType<typeof vi.fn>;
} {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    kill: vi.fn(),
  });
}

beforeEach(() => {
  vi.resetModules();
  spawn.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('listModels för Codex', () => {
  it('initialiserar, hämtar alla sidor och återanvänder listan', async () => {
    const child = fakeProcess();
    spawn.mockReturnValue(child);
    const requests: Record<string, unknown>[] = [];
    child.stdin.on('data', (data: Buffer) => {
      requests.push(JSON.parse(data.toString()) as Record<string, unknown>);
    });
    const { listModels } = await import('./models');
    const pending = listModels('codex');
    expect(requests[0]).toMatchObject({ id: 'yart-initialize', method: 'initialize' });
    const reply = (message: unknown): void => {
      child.stdout.write(`${JSON.stringify(message)}\n`);
    };
    reply({ id: 'yart-initialize', result: { userAgent: 'codex' } });
    expect(requests.slice(1)).toEqual([
      { method: 'initialized' },
      { id: 'yart-models', method: 'model/list', params: { includeHidden: false } },
    ]);
    // Loggar och orelaterade notifieringar påverkar inte hämtningen.
    child.stdout.write('not json\n');
    reply({ method: 'notification' });
    reply({ id: 'yart-models', result: { data: [{ model: 'first' }], nextCursor: 'next' } });
    expect(requests.at(-1)).toEqual({
      id: 'yart-models',
      method: 'model/list',
      params: { includeHidden: false, cursor: 'next' },
    });
    reply({
      id: 'yart-models',
      result: { data: [{ model: 'first' }, { model: 'second' }], nextCursor: null },
    });
    const models = await pending;
    expect(models.map((model) => model.value)).toEqual(['first', 'second']);
    expect(child.kill).toHaveBeenCalledOnce();
    expect(await listModels('codex')).toEqual(models);
    expect(spawn).toHaveBeenCalledOnce();
  });

  it('hanterar protokollfel och försöker igen vid nästa hämtning', async () => {
    const child = fakeProcess();
    spawn.mockReturnValue(child);
    const { listModels } = await import('./models');
    const pending = listModels('codex');
    child.stdout.write(
      `${JSON.stringify({ id: 'yart-initialize', error: { message: 'unsupported' } })}\n`,
    );
    expect(await pending).toEqual([]);
    expect(child.kill).toHaveBeenCalledOnce();
    const next = fakeProcess();
    spawn.mockReturnValue(next);
    const retry = listModels('codex');
    next.emit('error', new Error('failed to start'));
    expect(await retry).toEqual([]);
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('avslutar processen om svaret uteblir', async () => {
    vi.useFakeTimers();
    const child = fakeProcess();
    spawn.mockReturnValue(child);
    const { listModels } = await import('./models');
    const pending = listModels('codex');
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toEqual([]);
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
