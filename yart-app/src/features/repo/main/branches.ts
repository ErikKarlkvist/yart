import { simpleGit } from 'simple-git';
import { type BranchList } from '../ipc/channels';

/**
 * Lokala brancher och den utcheckade, samt fjärrbrancher som inte finns
 * lokalt (som origin/x). Tomt för mappar utan git.
 */
export async function listBranches(path: string): Promise<BranchList> {
  const git = simpleGit(path);
  if (!(await git.checkIsRepo().catch(() => false))) return { current: null, branches: [] };
  const local = await git.branchLocal();
  const all = await git.branch(['-a']).catch(() => local);
  const remote = all.all
    .filter((name) => name.startsWith('remotes/'))
    .map((name) => name.replace(/^remotes\//, ''))
    .filter((name) => !name.endsWith('/HEAD'))
    .filter((name) => !local.all.includes(name.replace(/^[^/]+\//, '')));
  return {
    current: local.detached ? null : local.current,
    branches: [...local.all, ...remote],
  };
}

/** Hämtar från alla fjärrar och rensar bort borttagna brancher. */
export async function fetchRepo(path: string): Promise<void> {
  await simpleGit(path).fetch(['--all', '--prune']);
}
