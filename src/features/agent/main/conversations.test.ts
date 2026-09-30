import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConversationStore } from './conversations';

describe('ConversationStore', () => {
  it('saves per-repository conversations and loads their messages on demand', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kire-conversations-'));
    try {
      const store = new ConversationStore(dir);
      const first = await store.create('/repo/a', 'codex', 'review', {
        head: 'feature/checkout',
        base: 'main',
      });
      const second = await store.create('/repo/a', 'claude');
      expect(await store.list('/repo/a')).toEqual([]);
      expect(await store.get('/repo/a', first.id)).toMatchObject({ mode: 'review', entries: [] });
      await Promise.all([
        store.append('/repo/a', first.id, {
          at: '2099-09-29T10:00:00Z',
          kind: 'user',
          text: 'Explain checkout',
        }),
        store.append('/repo/a', first.id, {
          at: '2099-09-29T10:00:01Z',
          kind: 'assistant',
          text: 'It creates an order.',
        }),
        store.setThread('/repo/a', first.id, 'thread-123'),
      ]);
      expect((await store.list('/repo/a')).map((item) => item.id)).toEqual([first.id]);
      expect(await store.list('/repo/b')).toEqual([]);
      const reopened = new ConversationStore(dir);
      expect(await reopened.get('/repo/a', first.id)).toMatchObject({
        title: 'Explain checkout',
        mode: 'review',
        reviewBranches: { head: 'feature/checkout', base: 'main' },
        threadId: 'thread-123',
        entries: [
          { kind: 'user', text: 'Explain checkout' },
          { kind: 'assistant', text: 'It creates an order.' },
        ],
      });
      expect(await reopened.get('/repo/a', second.id)).toBeNull();
      expect(await reopened.get('/repo/b', first.id)).toBeNull();
      expect(await reopened.get('/repo/a', '../index')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
