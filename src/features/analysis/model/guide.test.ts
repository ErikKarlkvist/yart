import { describe, expect, it } from 'vitest';
import { demoFlows } from '@/common/model/fixtures';
import { nodeKindSchema, systemKindSchema, validateFlow } from '@/common/model/flow';
import { buildGuide, errorsFileFor, isFlowFile } from './guide';

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
