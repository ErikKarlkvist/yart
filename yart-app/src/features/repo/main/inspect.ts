import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { simpleGit } from 'simple-git';
import { summarizeLanguages } from '../model/languages';
import { type RepoInfo } from '../model/repo';

const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'target', '.next']);

/** Samlar grundinfo om ett repo. Använder git för fillistan när det går, så .gitignore respekteras. */
export async function inspectRepo(path: string): Promise<RepoInfo> {
  const git = simpleGit(path);
  const isGit = await git.checkIsRepo().catch(() => false);

  let branch: string | null = null;
  let origin: string | null = null;
  let files: string[];

  if (isGit) {
    branch = await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => null);
    const remotes = await git.getRemotes(true).catch(() => []);
    origin = remotes.find((r) => r.name === 'origin')?.refs.fetch ?? remotes[0]?.refs.fetch ?? null;
    // Spårade + ospårade men inte ignorerade filer.
    const output = await git.raw(['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
    files = output.split('\0').filter(Boolean);
  } else {
    files = await walk(path);
  }

  return {
    path,
    name: basename(path),
    isGit,
    branch: branch === 'HEAD' ? null : branch,
    origin,
    fileCount: files.length,
    languages: summarizeLanguages(files),
    lastOpenedAt: new Date().toISOString(),
  };
}

async function walk(root: string): Promise<string[]> {
  const result: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        result.push(relative(root, full));
      }
    }
  }
  return result;
}
