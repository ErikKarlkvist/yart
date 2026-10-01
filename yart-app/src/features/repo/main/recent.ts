import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import { pushRecent, recentReposSchema, type RepoInfo } from '../model/repo';

function storePath(): string {
  return join(app.getPath('userData'), 'recent-repos.json');
}

export async function readRecent(): Promise<RepoInfo[]> {
  try {
    const raw = await readFile(storePath(), 'utf8');
    const parsed = recentReposSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function writeRecent(list: RepoInfo[]): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(list, null, 2), 'utf8');
}

export async function rememberRepo(repo: RepoInfo): Promise<RepoInfo[]> {
  const list = pushRecent(await readRecent(), repo);
  await writeRecent(list);
  return list;
}

export async function forgetRepo(path: string): Promise<RepoInfo[]> {
  const list = (await readRecent()).filter((r) => r.path !== path);
  await writeRecent(list);
  return list;
}
