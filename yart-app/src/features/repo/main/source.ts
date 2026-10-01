import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { headRef, readFileAtCommit } from '@/common/main/git';
import { t } from '@/common/model/i18n';
import { type SourceExcerpt } from '../ipc/channels';

const DEFAULT_CONTEXT = 8;

/**
 * Rader runt en källhänvisning. Ur arbetsträdet, eller ur `commit` när den
 * inte är den utcheckade, så att ett flöde för en annan branch visar rätt kod.
 */
export async function readSource(
  repoPath: string,
  file: string,
  line: number,
  context = DEFAULT_CONTEXT,
  commit?: string,
): Promise<SourceExcerpt> {
  const root = resolve(repoPath);
  const absolute = resolve(root, file);
  if (!absolute.startsWith(root + sep)) {
    throw new Error(t('error.outsideRepo', { file }));
  }
  const content = await readAt(repoPath, absolute, file, commit);
  const all = content.split('\n');
  const startLine = Math.max(1, line - context);
  const endLine = Math.min(all.length, line + context);
  return { file, line, startLine, lines: all.slice(startLine - 1, endLine) };
}

async function readAt(
  repoPath: string,
  absolute: string,
  file: string,
  commit: string | undefined,
): Promise<string> {
  if (commit && (await headRef(repoPath))?.commit !== commit) {
    const content = await readFileAtCommit(repoPath, commit, file);
    if (content !== null) return content;
    throw new Error(t('error.missingAtCommit', { file, commit: commit.slice(0, 7) }));
  }
  return readFile(absolute, 'utf8');
}
