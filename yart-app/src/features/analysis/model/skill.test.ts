import { describe, expect, it } from 'vitest';
import { demoFlows } from '@/common/model/fixtures';
import {
  nodeKindSchema,
  systemKindSchema,
  triggerKindSchema,
  validateFlow,
} from '@/common/model/flow';
import { buildGuide, buildSkill, SKILL_VERSION } from './skill';

describe('buildSkill', () => {
  const skill = buildSkill();

  it('is short and points at the guide served over MCP', () => {
    expect(skill).toContain('Call `get_guide` once in the session');
    expect(skill).not.toContain('interface Flow {');
    expect(skill.split('\n').length).toBeLessThan(50);
  });

  it('is only used when the user asks for yart', () => {
    const frontmatter = skill.split('\n---\n')[0] ?? '';
    expect(frontmatter).toContain('Use only when the user asks for something in yart');
    expect(frontmatter).not.toContain('whenever');
    expect(skill).toContain('Only when the user asks for yart.');
    expect(skill).toContain('answer directly in chat');
  });

  it('has the frontmatter Claude Code expects and a version marker', () => {
    expect(skill.startsWith('---\nname: yart\ndescription: ')).toBe(true);
    expect(skill).toContain(`yart-skill v${SKILL_VERSION}`);
  });
});

describe('buildGuide', () => {
  const guide = buildGuide();

  it('keeps the review rule for requests that do not mention yart', () => {
    expect(guide).toContain('A review asked for without mentioning yart is answered the usual way');
  });

  it('delivers through the MCP tools and never through files in the repository', () => {
    for (const tool of ['save_flow', 'save_document', 'save_review', 'list_analyses'])
      expect(guide).toContain(`\`${tool}\``);
    expect(guide).toContain('git rev-parse --show-toplevel');
    expect(guide).not.toContain('.yart/');
    expect(guide).not.toContain('.errors.json');
  });

  it('lists every node and system kind the schema accepts', () => {
    for (const kind of [...nodeKindSchema.options, ...systemKindSchema.options]) {
      expect(guide).toContain(`'${kind}'`);
    }
  });

  it('chooses between documents, flows and reviews', () => {
    expect(guide).toContain('Choose the requested deliverable');
    expect(guide).toContain('Do not create Mermaid');
    expect(guide).toContain('two or three clear, explanatory sentences in active voice');
    expect(guide).toContain('for someone who has not read the code');
    expect(guide).toContain('Do not turn playback steps into suggestions');
    expect(guide).toContain('one companion document with all');
    expect(guide).toContain('two or three clear, explanatory sentences');
    expect(guide).toContain('before/after differences');
    expect(guide).toContain('interface Review {');
    expect(guide).toContain('interface FlowCompare {');
  });

  it('asks for the trigger, readable text and hidden detail for AI', () => {
    expect(guide).toContain('trigger: Trigger;');
    expect(guide).toContain('interface Trigger {');
    for (const kind of triggerKindSchema.options) expect(guide).toContain(`'${kind}'`);
    expect(guide).toContain('Write for people, keep the detail for AI');
    expect(guide).toContain('plan?: string;');
    expect(guide).toContain('fix?: string;');
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(guide)?.[1] ?? '{}') as {
      trigger?: unknown;
    };
    expect(example.trigger).toBeDefined();
  });

  it('embeds an example that validates against the schema', () => {
    const json = /```json\n([\s\S]*?)\n```/.exec(guide)?.[1];
    expect(json).toBeDefined();
    const parsed = validateFlow(JSON.parse(json ?? ''));
    expect(parsed.ok).toBe(true);
    expect(demoFlows.some((flow) => flow.title === (parsed.ok ? parsed.flow.title : ''))).toBe(
      true,
    );
  });
});
