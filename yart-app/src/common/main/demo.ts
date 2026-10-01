import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from 'electron';
import { DEMO_REPO_RELATIVE_PATH } from '@/common/model/fixtures';
import { t } from '@/common/model/i18n';

/** Under utveckling är app-sökvägen projektroten. I en paketerad app finns inte demot. */
export function demoRepoPath(): string {
  const path = resolve(app.getAppPath(), DEMO_REPO_RELATIVE_PATH);
  if (!existsSync(path)) throw new Error(t('error.demoMissing', { path }));
  return path;
}

export function isDemoRepo(path: string): boolean {
  try {
    return resolve(path) === demoRepoPath();
  } catch {
    return false;
  }
}
