import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SKILL_RELATIVE_PATH, type SkillState } from '../model/mcp';

export function skillPath(homeDir: string): string {
  return join(homeDir, SKILL_RELATIVE_PATH);
}

/** Jämför den installerade kopian med det appen skulle skriva. */
export async function skillState(path: string, content: string): Promise<SkillState> {
  const current = await readFile(path, 'utf8').catch(() => null);
  if (current === null) return 'missing';
  return current === content ? 'current' : 'outdated';
}

export async function installSkill(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
