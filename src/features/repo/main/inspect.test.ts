import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_REPO_RELATIVE_PATH } from '@/common/model/fixtures';
import { inspectRepo } from './inspect';

describe('inspectRepo', () => {
  it('läser ett git-repo och respekterar .gitignore', async () => {
    const root = resolve(import.meta.dirname, '../../../..');
    const info = await inspectRepo(root);
    expect(info.isGit).toBe(true);
    // Mappens namn på disk, oberoende av vad appen heter
    expect(info.name).toBe(basename(root));
    expect(info.branch).toBe('main');
    expect(info.fileCount).toBeGreaterThan(10);
    // node_modules är ignorerat och får inte räknas
    expect(info.fileCount).toBeLessThan(500);
    expect(info.languages[0]?.name).toBe('TypeScript');
  });

  it('läser demo-appen som undermapp i git-repot', async () => {
    const info = await inspectRepo(
      resolve(import.meta.dirname, '../../../..', DEMO_REPO_RELATIVE_PATH),
    );
    expect(info.name).toBe('todo-app');
    expect(info.isGit).toBe(true);
    expect(info.branch).toBe('main');
    expect(info.fileCount).toBeGreaterThan(20);
    expect(info.fileCount).toBeLessThan(40);
    expect(info.languages[0]?.name).toBe('TypeScript');
  });

  it('faller tillbaka på filvandring för mappar utan git', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yart-'));
    await writeFile(join(dir, 'a.py'), '');
    await writeFile(join(dir, 'b.py'), '');
    await writeFile(join(dir, 'c.go'), '');
    const info = await inspectRepo(dir);
    expect(info.isGit).toBe(false);
    expect(info.branch).toBeNull();
    expect(info.fileCount).toBe(3);
    expect(info.languages).toEqual([
      { name: 'Python', files: 2 },
      { name: 'Go', files: 1 },
    ]);
  });
});
