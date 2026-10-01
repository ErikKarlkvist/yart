import { describe, expect, it } from 'vitest';
import { MAX_RECENT_REPOS, pushRecent, type RepoInfo } from './repo';

function repo(path: string): RepoInfo {
  return {
    path,
    name: path,
    isGit: true,
    branch: 'main',
    origin: null,
    fileCount: 0,
    languages: [],
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('pushRecent', () => {
  it('lägger först och tar bort dubbletter', () => {
    const list = pushRecent([repo('/a'), repo('/b')], repo('/b'));
    expect(list.map((r) => r.path)).toEqual(['/b', '/a']);
  });

  it('kapar till max', () => {
    let list: RepoInfo[] = [];
    for (let i = 0; i < MAX_RECENT_REPOS + 3; i++) list = pushRecent(list, repo(`/${i}`));
    expect(list).toHaveLength(MAX_RECENT_REPOS);
    expect(list[0]?.path).toBe(`/${MAX_RECENT_REPOS + 2}`);
  });
});
