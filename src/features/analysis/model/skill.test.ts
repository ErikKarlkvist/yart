import { describe, expect, it } from 'vitest';
import { demoFlows } from '@/common/model/fixtures';
import { nodeKindSchema, systemKindSchema, validateFlow } from '@/common/model/flow';
import { buildSkill, SKILL_VERSION } from './skill';

describe('buildSkill', () => {
  const skill = buildSkill();

  it('has the frontmatter Claude Code expects and a version marker', () => {
    expect(skill.startsWith('---\nname: reverik\ndescription: ')).toBe(true);
    expect(skill).toContain(`reverik-skill v${SKILL_VERSION}`);
  });

  it('delivers through the MCP tools and never through files in the repository', () => {
    for (const tool of ['save_flow', 'save_document', 'save_review', 'list_analyses'])
      expect(skill).toContain(`\`${tool}\``);
    expect(skill).toContain('git rev-parse --show-toplevel');
    expect(skill).not.toContain('.reverik/');
    expect(skill).not.toContain('.errors.json');
  });

  it('lists every node and system kind the schema accepts', () => {
    for (const kind of [...nodeKindSchema.options, ...systemKindSchema.options]) {
      expect(skill).toContain(`'${kind}'`);
    }
  });

  it('chooses between documents, flows and reviews', () => {
    expect(skill).toContain('Choose the deliverable that matches the question');
    expect(skill).toContain('Do not create Mermaid');
    expect(skill).toContain('clear, human sentences in active voice');
    expect(skill).toContain('for someone who has not read the code');
    expect(skill).toContain('Do not turn playback steps into suggestions');
    expect(skill).toContain('save a companion');
    expect(skill).toContain('before/after differences');
    expect(skill).toContain('interface Review {');
    expect(skill).toContain('interface FlowCompare {');
  });

  it('embeds an example that validates against the schema', () => {
    const json = /```json\n([\s\S]*?)\n```/.exec(skill)?.[1];
    expect(json).toBeDefined();
    const parsed = validateFlow(JSON.parse(json ?? ''));
    expect(parsed.ok).toBe(true);
    expect(demoFlows.some((flow) => flow.title === (parsed.ok ? parsed.flow.title : ''))).toBe(
      true,
    );
  });
});
