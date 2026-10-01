import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addTodoFlow, listTodosFlow } from '@/common/model/fixtures';
import { type YartDocument } from '@/common/model/document';
import { AnalysisStore } from './store';

describe('AnalysisStore', () => {
  let store: AnalysisStore;

  beforeEach(async () => {
    store = new AnalysisStore(await mkdtemp(join(tmpdir(), 'yart-analyses-')));
  });

  it('är tom från början', async () => {
    expect(await store.list('/repo')).toEqual([]);
  });

  it('sparar, listar nyast först och tar bort', async () => {
    const first = await store.upsert('/repo', {
      name: 'add-todo',
      kind: 'flow',
      flow: addTodoFlow,
    });
    const second = await store.upsert('/repo', {
      name: 'list-todos',
      kind: 'flow',
      flow: listTodosFlow,
    });
    const listed = await store.list('/repo');
    expect(listed.map((a) => a.id)).toEqual([second.id, first.id]);
    expect(listed[0]?.origin).toBe('ai');

    const remaining = await store.delete('/repo', second.id);
    expect(remaining.map((a) => a.id)).toEqual([first.id]);
  });

  it('håller isär repon', async () => {
    await store.upsert('/a', { name: 'add-todo', kind: 'flow', flow: addTodoFlow });
    expect(await store.list('/b')).toEqual([]);
  });

  it('ersätter en analys med samma sort och namn och behåller id', async () => {
    const document: YartDocument = {
      title: 'Overview',
      summary: 'A short overview.',
      content: 'The app calls the API.',
      flows: ['call-api'],
    };
    const first = await store.upsert('/repo', { name: 'overview', kind: 'document', document });
    const updated = await store.upsert('/repo', {
      name: 'overview',
      kind: 'document',
      document: { ...document, summary: 'A clearer overview.' },
    });
    const listed = await store.list('/repo');

    expect(updated.id).toBe(first.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ kind: 'document', document: { title: 'Overview' } });
    expect(await store.get('/repo', 'document', 'overview')).toMatchObject({ id: first.id });
    expect(await store.get('/repo', 'flow', 'overview')).toBeNull();
  });

  it('låter ett flöde och ett dokument dela namn', async () => {
    await store.upsert('/repo', { name: 'todos', kind: 'flow', flow: addTodoFlow });
    await store.upsert('/repo', {
      name: 'todos',
      kind: 'document',
      document: { title: 'Todos', summary: 'x', content: 'y', flows: [] },
    });
    expect(await store.list('/repo')).toHaveLength(2);
  });

  it('tappar inget när flera sparar samtidigt', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        store.upsert('/repo', { name: `flow-${i}`, kind: 'flow', flow: addTodoFlow }),
      ),
    );
    expect(await store.list('/repo')).toHaveLength(5);
  });
});
