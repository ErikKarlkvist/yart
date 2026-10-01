import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { expect, it } from 'vitest';
import { currentBranch } from './branches';

it('läser en branch som checkats ut utanför appen och detached HEAD', async () => {
  const path = await mkdtemp(join(tmpdir(), 'yart-branch-'));
  try {
    const git = simpleGit(path);
    await git.init();
    await git.addConfig('user.name', 'Yart Test');
    await git.addConfig('user.email', 'yart@example.test');
    await git.raw(['commit', '--allow-empty', '-m', 'initial']);

    await git.checkoutLocalBranch('feature/detected');
    expect(await currentBranch(path)).toBe('feature/detected');

    await git.checkout(['--detach', 'HEAD']);
    expect(await currentBranch(path)).toBeNull();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
