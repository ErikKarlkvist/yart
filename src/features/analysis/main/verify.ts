import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { readFileAtCommit } from '@/common/main/git';
import { type Flow, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';

interface Ref {
  where: string;
  source: SourceRef;
}

function collectRefs(flow: Flow): Ref[] {
  const refs: Ref[] = [];
  flow.nodes.forEach((node, i) => {
    if (node.source) refs.push({ where: `nodes.${i}.source`, source: node.source });
    node.tables?.forEach((table, ti) => {
      if (table.source)
        refs.push({ where: `nodes.${i}.tables.${ti}.source`, source: table.source });
    });
  });
  flow.edges.forEach((edge, i) => {
    if (edge.source) refs.push({ where: `edges.${i}.source`, source: edge.source });
  });
  return refs;
}

/** Läser en fil ur arbetsträdet, null utanför repot eller om den saknas. */
async function readWorkingTree(repoPath: string, file: string): Promise<string | null> {
  const root = resolve(repoPath);
  const absolute = resolve(root, file);
  if (!absolute.startsWith(root + sep)) return null;
  try {
    return await readFile(absolute, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Kontrollerar att varje källhänvisning pekar på en fil och en rad som finns,
 * i arbetsträdet eller i en given commit. Felen är skrivna för att skickas
 * tillbaka till AI:n.
 */
export async function verifySources(
  repoPath: string,
  flow: Flow,
  commit: string | null = null,
): Promise<string[]> {
  const lineCounts = new Map<string, number | null>();

  async function countLines(file: string): Promise<number | null> {
    const cached = lineCounts.get(file);
    if (cached !== undefined) return cached;
    const content = commit
      ? await readFileAtCommit(repoPath, commit, file)
      : await readWorkingTree(repoPath, file);
    const count = content === null ? null : content.split('\n').length;
    lineCounts.set(file, count);
    return count;
  }

  const errors: string[] = [];
  for (const { where, source } of collectRefs(flow)) {
    const count = await countLines(source.file);
    if (count === null) {
      errors.push(
        commit
          ? t('verify.missingFileAt', { where, file: source.file, commit: commit.slice(0, 7) })
          : t('verify.missingFile', { where, file: source.file }),
      );
      continue;
    }
    for (const line of [source.line, source.endLine ?? source.line]) {
      if (line > count) {
        errors.push(t('verify.lineOutOfRange', { where, file: source.file, count, line }));
        break;
      }
    }
  }
  return errors;
}
