import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkill, skillPath, skillState } from './skill';

describe('skill', () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'reverik-skill-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it('ligger där Claude Code letar efter personliga skills', () => {
    expect(skillPath('/home/me')).toBe('/home/me/.claude/skills/reverik/SKILL.md');
  });

  it('installerar och känner igen en aktuell eller gammal kopia', async () => {
    const path = skillPath(home);
    expect(await skillState(path, 'v2')).toBe('missing');
    await installSkill(path, 'v1');
    expect(await skillState(path, 'v2')).toBe('outdated');
    await installSkill(path, 'v2');
    expect(await skillState(path, 'v2')).toBe('current');
  });
});
