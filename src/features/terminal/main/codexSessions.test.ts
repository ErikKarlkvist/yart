import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { codexSessionIdFromPath, findNewCodexSession, listCodexSessions } from './codexSessions';

let directory: string;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('codexSessionIdFromPath', () => {
  it('extracts a session id from the Codex rollout filename', () => {
    expect(
      codexSessionIdFromPath(
        'C:/Users/test/.codex/sessions/2026/09/28/rollout-2026-09-28T10-00-00-12345678-1234-1234-1234-123456789abc.jsonl',
      ),
    ).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('ignores session files without a UUID suffix', () => {
    expect(codexSessionIdFromPath('rollout-older.jsonl')).toBeNull();
  });

  it('associates only a new session file for the requested repository', async () => {
    directory = await mkdtemp(join(tmpdir(), 'reverik-codex-'));
    const day = join(directory, '2026', '09', '28');
    await mkdir(day, { recursive: true });
    const existing = join(
      day,
      'rollout-2026-09-28T10-00-00-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jsonl',
    );
    const matching = join(
      day,
      'rollout-2026-09-28T10-01-00-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jsonl',
    );
    const otherRepo = join(
      day,
      'rollout-2026-09-28T10-02-00-cccccccc-cccc-cccc-cccc-cccccccccccc.jsonl',
    );
    await writeFile(existing, JSON.stringify({ payload: { cwd: 'D:/repo' } }));
    await writeFile(matching, JSON.stringify({ payload: { cwd: 'D:/repo' } }));
    await writeFile(otherRepo, JSON.stringify({ payload: { cwd: 'D:/other' } }));

    await expect(findNewCodexSession(directory, new Set([existing]), 'D:/repo')).resolves.toBe(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
  });
});

describe('listCodexSessions', () => {
  it('lists chats for one repository using their first user message as the title', async () => {
    directory = await mkdtemp(join(tmpdir(), 'reverik-codex-list-'));
    const day = join(directory, '2026', '09', '28');
    await mkdir(day, { recursive: true });
    const matching = join(
      day,
      'rollout-2026-09-28T10-01-00-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jsonl',
    );
    const otherRepo = join(
      day,
      'rollout-2026-09-28T10-02-00-cccccccc-cccc-cccc-cccc-cccccccccccc.jsonl',
    );
    await writeFile(
      matching,
      [
        JSON.stringify({ type: 'session_meta', payload: { cwd: 'D:/repo' } }),
        JSON.stringify({
          type: 'event_msg',
          payload: { type: 'user_message', message: 'Explain seating flow' },
        }),
      ].join('\n'),
    );
    await writeFile(
      otherRepo,
      JSON.stringify({ type: 'session_meta', payload: { cwd: 'D:/other' } }),
    );

    const sessions = await listCodexSessions('D:/repo', directory);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Explain seating flow',
    });
    expect(typeof sessions[0]?.updatedAt).toBe('number');
  });
});
