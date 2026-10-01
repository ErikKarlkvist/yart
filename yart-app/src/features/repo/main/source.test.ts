import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_REPO_RELATIVE_PATH } from '@/common/model/fixtures';
import { readSource } from './source';

const DEMO = resolve(import.meta.dirname, '../../../..', DEMO_REPO_RELATIVE_PATH);

describe('readSource', () => {
  it('läser rader runt en rad i demo-appen', async () => {
    const excerpt = await readSource(DEMO, 'backend/src/services/TodoService.ts', 22, 2);
    expect(excerpt.startLine).toBe(20);
    expect(excerpt.lines).toHaveLength(5);
    expect(excerpt.lines[2]).toContain('repository.insert');
  });

  it('klipper vid filens början', async () => {
    const excerpt = await readSource(DEMO, 'backend/src/server.ts', 1, 3);
    expect(excerpt.startLine).toBe(1);
    expect(excerpt.lines).toHaveLength(4);
  });

  it('vägrar läsa utanför repot', async () => {
    await expect(readSource(DEMO, '../../package.json', 1)).rejects.toThrow(
      'outside the repository',
    );
  });
});
