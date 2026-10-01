import { describe, expect, it } from 'vitest';
import { addTodoFlow } from '@/common/model/fixtures';
import { type SavedAnalysis, savedAnalysisSchema, slugify, sortAnalyses } from './analysis';

const base: SavedAnalysis = {
  id: 'a',
  repoPath: '/repo',
  origin: 'ai',
  createdAt: '2026-01-02T00:00:00.000Z',
  name: 'add-todo',
  kind: 'flow',
  flow: addTodoFlow,
};

describe('savedAnalysisSchema', () => {
  it('validerar en analys med fixture-flöde', () => {
    expect(savedAnalysisSchema.safeParse(base).success).toBe(true);
  });

  it('läser äldre sparade flöden utan typfält som flow', () => {
    const { kind: _kind, ...legacy } = base;
    expect(savedAnalysisSchema.parse(legacy).kind).toBe('flow');
  });

  it('ger äldre analyser ett namn ur filen eller id:t', () => {
    const { name: _name, ...unnamed } = base;
    expect(savedAnalysisSchema.parse({ ...unnamed, file: '.yart/flows/add-todo.json' }).name).toBe(
      'add-todo',
    );
    expect(savedAnalysisSchema.parse({ ...unnamed, id: 'builtin:0' }).name).toBe(
      'legacy-builtin-0',
    );
  });

  it('avvisar trasigt flöde', () => {
    const broken = { ...base, flow: { ...addTodoFlow, steps: [] } };
    expect(savedAnalysisSchema.safeParse(broken).success).toBe(false);
  });
});

describe('sortAnalyses', () => {
  it('sorterar nyast först utan att mutera', () => {
    const older = { ...base, id: 'b', createdAt: '2026-01-01T00:00:00.000Z' };
    const input = [older, base];
    expect(sortAnalyses(input).map((a) => a.id)).toEqual(['a', 'b']);
    expect(input[0]?.id).toBe('b');
  });
});

describe('slugify', () => {
  it('gör ett namn av en titel', () => {
    expect(slugify('Add todo')).toBe('add-todo');
    expect(slugify('  List todos (cached)! ')).toBe('list-todos-cached');
    expect(slugify('***')).toBe('analysis');
  });
});
