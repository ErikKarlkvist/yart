import { describe, expect, it } from 'vitest';
import { demoFlows } from '@/common/model/fixtures';
import { nodeKindSchema, systemKindSchema, validateFlow } from '@/common/model/flow';
import { buildGuide, buildSkill, errorsFileFor, isFlowFile, SKILL_VERSION } from './guide';

describe('buildGuide', () => {
  const guide = buildGuide();

  it('lists every node and system kind the schema accepts', () => {
    for (const kind of [...nodeKindSchema.options, ...systemKindSchema.options]) {
      expect(guide).toContain(`'${kind}'`);
    }
  });

  it('chooses between overview documents and detailed flow diagrams', () => {
    expect(guide).toContain('Choose the deliverable that matches the question');
    expect(guide).toContain('Do not create Mermaid');
    expect(guide).toContain('clear, human sentences in active voice');
    expect(guide).toContain('.reverik/documents/<kebab-case-name>.json');
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

  it('shares the flow rules, schema and example with the guide', () => {
    expect(skill).toContain('clear, human sentences in active voice');
    expect(skill).toContain('interface Flow {');
    expect(skill).toContain('"title": "Load the list"');
  });
});

describe('flow file names', () => {
  it('treats only plain json files as flows', () => {
    expect(isFlowFile('add-todo.json')).toBe(true);
    expect(isFlowFile('add-todo.errors.json')).toBe(false);
    expect(isFlowFile('notes.md')).toBe(false);
  });

  it('derives the errors file name', () => {
    expect(errorsFileFor('add-todo.json')).toBe('add-todo.errors.json');
  });
});
