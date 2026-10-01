import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkill, skillPath, skillState } from './skill';

describe('skill', () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'yart-skill-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it('ligger där respektive agent letar efter personliga skills', () => {
    expect(relative(home, skillPath(home, 'claude')).replaceAll('\\', '/')).toBe(
      '.claude/skills/yart/SKILL.md',
    );
    expect(relative(home, skillPath(home, 'codex')).replaceAll('\\', '/')).toBe(
      '.codex/skills/yart/SKILL.md',
    );
  });

  it('installerar och känner igen en aktuell eller gammal kopia', async () => {
    const path = skillPath(home, 'claude');
    expect(await skillState(path, 'v2')).toBe('missing');
    await installSkill(path, 'v1');
    expect(await skillState(path, 'v2')).toBe('outdated');
    await installSkill(path, 'v2');
    expect(await skillState(path, 'v2')).toBe('current');
  });
});
