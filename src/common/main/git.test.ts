import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { headRef, readFileAtCommit, resolveCommit } from './git';

/** Ett litet repo: main med a.txt, branchen feature lägger till b.txt, main utcheckad. */
export async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'yart-git-'));
  const git = simpleGit(dir);
  await git.raw(['init', '-b', 'main']);
  await git.addConfig('user.name', 'Test');
  await git.addConfig('user.email', 'test@example.com');
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\n');
  await git.add('.');
  await git.commit('a');
  await git.checkoutLocalBranch('feature');
  await writeFile(join(dir, 'b.txt'), 'b1\nb2\nb3\n');
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  await git.add('.');
  await git.commit('b');
  await git.checkout('main');
  return dir;
}

describe('git helpers', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await makeRepo();
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('löser referenser till commits', async () => {
    const feature = await resolveCommit(dir, 'feature');
    expect(feature).toMatch(/^[0-9a-f]{40}$/);
    expect(await resolveCommit(dir, 'nope')).toBeNull();
    expect(await resolveCommit('/tmp', 'main')).toBeNull();
  });

  it('läser utcheckad branch och commit', async () => {
    const head = await headRef(dir);
    expect(head?.branch).toBe('main');
    expect(head?.commit).toBe(await resolveCommit(dir, 'main'));
  });

  it('läser filer i en commit som inte är utcheckad', async () => {
    const feature = await resolveCommit(dir, 'feature');
    if (!feature) throw new Error('feature saknas');
    expect(await readFileAtCommit(dir, feature, 'b.txt')).toBe('b1\nb2\nb3\n');
    expect(await readFileAtCommit(dir, feature, 'a.txt')).toBe('one\ntwo\nthree\n');
    const main = await resolveCommit(dir, 'main');
    if (!main) throw new Error('main saknas');
    expect(await readFileAtCommit(dir, main, 'b.txt')).toBeNull();
  });
});
