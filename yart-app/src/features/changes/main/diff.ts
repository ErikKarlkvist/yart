import { simpleGit } from 'simple-git';
import { type FileDiff, parseUnifiedDiff } from '../model/diff';

/**
 * Det head ändrat sedan det skildes från base, med sökvägar relativa repots
 * mapp så de matchar flödenas källhänvisningar också när repot ligger i en
 * undermapp till git-roten.
 */
export async function readDiff(repoPath: string, base: string, head: string): Promise<FileDiff[]> {
  const text = await simpleGit(repoPath).diff([
    '--no-color',
    '--find-renames',
    '--relative',
    `${base}...${head}`,
  ]);
  return parseUnifiedDiff(text);
}
