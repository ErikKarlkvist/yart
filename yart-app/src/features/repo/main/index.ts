import { BrowserWindow, dialog } from 'electron';
import { demoRepoPath } from '@/common/main/demo';
import { handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import {
  fetchRepoChannel,
  forgetRepoChannel,
  listBranchesChannel,
  listRecentReposChannel,
  openDemoRepoChannel,
  openRepoChannel,
  pickLocalRepoChannel,
  readSourceChannel,
} from '../ipc/channels';
import { type RepoInfo } from '../model/repo';
import { fetchRepo, listBranches } from './branches';
import { inspectRepo } from './inspect';
import { forgetRepo, readRecent, rememberRepo } from './recent';

export { readRecent } from './recent';
import { readSource } from './source';

export function registerRepoHandlers(): void {
  handleChannel(pickLocalRepoChannel, async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const options = { properties: ['openDirectory' as const], title: t('repo.dialogTitle') };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    return openAndRemember(path);
  });

  handleChannel(openDemoRepoChannel, () => openAndRemember(demoRepoPath()));

  handleChannel(openRepoChannel, ({ path }) => openAndRemember(path));

  handleChannel(listRecentReposChannel, () => readRecent());

  handleChannel(forgetRepoChannel, ({ path }) => forgetRepo(path));

  handleChannel(readSourceChannel, ({ repoPath, file, line, context, commit }) =>
    readSource(repoPath, file, line, context, commit),
  );

  handleChannel(listBranchesChannel, ({ repoPath }) => listBranches(repoPath));

  handleChannel(fetchRepoChannel, async ({ repoPath }) => {
    await fetchRepo(repoPath);
    return openAndRemember(repoPath);
  });
}

export async function openAndRemember(path: string): Promise<RepoInfo> {
  const repo = await inspectRepo(path);
  await rememberRepo(repo);
  return repo;
}
