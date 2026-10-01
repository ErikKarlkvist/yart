import { z } from 'zod';

const languageStatSchema = z.object({
  name: z.string(),
  files: z.number().int().nonnegative(),
});

const repoInfoSchema = z.object({
  /** Absolut sökväg till repots rot. */
  path: z.string().min(1),
  name: z.string().min(1),
  isGit: z.boolean(),
  branch: z.string().nullable(),
  origin: z.string().nullable(),
  fileCount: z.number().int().nonnegative(),
  languages: z.array(languageStatSchema),
  /** ISO-tidsstämpel för när repot senast öppnades i appen. */
  lastOpenedAt: z.string(),
});

export type RepoInfo = z.infer<typeof repoInfoSchema>;
export type LanguageStat = z.infer<typeof languageStatSchema>;

export const recentReposSchema = z.array(repoInfoSchema);

export const MAX_RECENT_REPOS = 10;

/** Lägger repot först i listan, tar bort dubbletter på sökväg och kapar längden. */
export function pushRecent(recent: readonly RepoInfo[], repo: RepoInfo): RepoInfo[] {
  return [repo, ...recent.filter((r) => r.path !== repo.path)].slice(0, MAX_RECENT_REPOS);
}
