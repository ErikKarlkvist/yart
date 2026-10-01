import { defineChannel } from '@/common/ipc/channel';
import { type RepoInfo } from '../model/repo';

/** Öppnar systemdialog för att välja en lokal mapp. null om användaren avbryter. */
export const pickLocalRepoChannel = defineChannel<undefined, RepoInfo | null>('repo:pick-local');

/** Öppnar demo-appen som ligger i Yart-repot under demo/todo-app. */
export const openDemoRepoChannel = defineChannel<undefined, RepoInfo>('repo:open-demo');

/** Läser om ett repo på en känd sökväg, t.ex. från listan över senaste. */
export const openRepoChannel = defineChannel<{ path: string }, RepoInfo>('repo:open');

export const listRecentReposChannel = defineChannel<undefined, RepoInfo[]>('repo:list-recent');

export const forgetRepoChannel = defineChannel<{ path: string }, RepoInfo[]>('repo:forget');

export interface SourceExcerpt {
  file: string;
  /** Raden som efterfrågades */
  line: number;
  /** Radnummer för första raden i `lines` */
  startLine: number;
  lines: string[];
}

/**
 * Läser rader runt en källhänvisning. Sökvägen måste ligga inom repot. Med
 * `commit` läses filen ur den commiten när den inte är utcheckad.
 */
export const readSourceChannel = defineChannel<
  { repoPath: string; file: string; line: number; context?: number; commit?: string },
  SourceExcerpt
>('repo:read-source');

export interface BranchList {
  /** Utcheckad branch, null vid detached HEAD eller utan git */
  current: string | null;
  /** Lokala brancher först, sedan fjärrbrancher som origin/x som inte finns lokalt */
  branches: string[];
}

export const listBranchesChannel = defineChannel<{ repoPath: string }, BranchList>(
  'repo:list-branches',
);

/** Kör git fetch och läser om repot, så nya brancher syns. */
export const fetchRepoChannel = defineChannel<{ repoPath: string }, RepoInfo>('repo:fetch');
