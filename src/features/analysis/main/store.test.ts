import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addTodoFlow, listTodosFlow } from '@/common/model/fixtures';
import { type ReverikDocument } from '@/common/model/document';
import { AnalysisStore } from './store';

describe('AnalysisStore', () => {
  let store: AnalysisStore;

  beforeEach(async () => {
    store = new AnalysisStore(await mkdtemp(join(tmpdir(), 'reverik-analyses-')));
  });

  it('är tom från början', async () => {
    expect(await store.list('/repo')).toEqual([]);
  });

  it('sparar, listar nyast först och tar bort', async () => {
    const first = await store.save('/repo', addTodoFlow);
    const second = await store.save('/repo', listTodosFlow);
    const listed = await store.list('/repo');
    expect(listed.map((a) => a.id)).toEqual([second.id, first.id]);
    expect(listed[0]?.origin).toBe('ai');

    const remaining = await store.delete('/repo', second.id);
    expect(remaining.map((a) => a.id)).toEqual([first.id]);
  });

  it('håller isär repon', async () => {
    await store.save('/a', addTodoFlow);
    expect(await store.list('/b')).toEqual([]);
  });

  it('sparar och uppdaterar dokument med stabilt id', async () => {
    const document: ReverikDocument = {
      title: 'Overview',
      summary: 'A short overview.',
      content: 'The app calls the API.',
      flowFiles: ['.reverik/flows/call-api.json'],
    };
    const first = await store.upsertDocumentFromFile(
      '/repo',
      '.reverik/documents/overview.json',
      document,
    );
    const updated = await store.upsertDocumentFromFile(
      '/repo',
      '.reverik/documents/overview.json',
      {
        ...document,
        summary: 'A clearer overview.',
      },
    );
    const listed = await store.list('/repo');

    expect(updated.id).toBe(first.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ kind: 'document', document: { title: 'Overview' } });
  });
});
