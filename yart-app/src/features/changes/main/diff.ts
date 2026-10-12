import { simpleGit } from 'simple-git';
import { isDemoRepo } from '@/common/main/demo';
import { TODO_LISTS_DIFF } from '@/common/model/fixtures';
import { type FileDiff, parseUnifiedDiff } from '../model/diff';

/**
 * Det head ändrat sedan det skildes från base, med sökvägar relativa repots
 * mapp så de matchar flödenas källhänvisningar också när repot ligger i en
 * undermapp till git-roten. Demot har ingen sådan branch och får sin fixture.
 */
export async function readDiff(repoPath: string, base: string, head: string): Promise<FileDiff[]> {
  if (isDemoRepo(repoPath)) return parseUnifiedDiff(TODO_LISTS_DIFF);
  const text = await simpleGit(repoPath).diff([
    '--no-color',
    '--find-renames',
    '--relative',
    `${base}...${head}`,
  ]);
  return parseUnifiedDiff(text);
}
