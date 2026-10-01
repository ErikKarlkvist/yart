import { simpleGit } from 'simple-git';

export interface GitRef {
  /** Branchnamn, null vid detached HEAD */
  branch: string | null;
  commit: string;
}

/** Commiten en referens pekar på, null om den inte finns i repot eller repot saknar git. */
export async function resolveCommit(repoPath: string, ref: string): Promise<string | null> {
  try {
    const out = await simpleGit(repoPath).raw([
      'rev-parse',
      '--verify',
      '--quiet',
      `${ref}^{commit}`,
    ]);
    const commit = out.trim();
    return commit.length > 0 ? commit : null;
  } catch {
    return null;
  }
}

/** Utcheckad branch och commit, null utan git. */
export async function headRef(repoPath: string): Promise<GitRef | null> {
  try {
    const git = simpleGit(repoPath);
    const commit = (await git.revparse(['HEAD'])).trim();
    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    return { branch: branch === 'HEAD' ? null : branch, commit };
  } catch {
    return null;
  }
}

/** Filens innehåll i en commit, null om filen inte finns där. Sökvägen är relativ repots rot. */
export async function readFileAtCommit(
  repoPath: string,
  commit: string,
  file: string,
): Promise<string | null> {
  try {
    return await simpleGit(repoPath).show([`${commit}:${file}`]);
  } catch {
    return null;
  }
}
