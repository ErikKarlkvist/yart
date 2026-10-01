import { describe, expect, it } from 'vitest';
import {
  addTodoFlow,
  addTodoReview,
  addTodoWithListCompare,
  addTodoWithListFlow,
} from '@/common/model/fixtures';
import {
  type SavedDocumentAnalysis,
  type SavedFlowAnalysis,
  type SavedReviewAnalysis,
} from './analysis';
import { buildImplementationPlan, buildReviewFixPlan, hasImplementationPlan } from './plan';

const base = { repoPath: '/repo', origin: 'ai' as const, createdAt: '2026-01-01T00:00:00Z' };

const listFlow: SavedFlowAnalysis = {
  ...base,
  id: 'f1',
  kind: 'flow',
  name: 'add-todo-to-a-list',
  flow: addTodoWithListFlow,
  compare: addTodoWithListCompare,
};

const review: SavedReviewAnalysis = {
  ...base,
  id: 'r1',
  kind: 'review',
  name: 'todo-lists',
  review: addTodoReview,
};

const document = (plan?: string): SavedDocumentAnalysis => ({
  ...base,
  id: 'd1',
  kind: 'document',
  name: 'due-dates',
  document: {
    title: 'Due dates',
    summary: 'Todos get an optional due date.',
    content: '## What changes\n- A date field on the form',
    flows: ['add-todo'],
    ...(plan ? { plan } : {}),
  },
});

const addFlow: SavedFlowAnalysis = {
  ...base,
  id: 'f2',
  kind: 'flow',
  name: 'add-todo',
  flow: addTodoFlow,
};

describe('buildReviewFixPlan', () => {
  it('tar bara med valda fynd, allvarligast först, med anrop, kod och fix', () => {
    const [cache, webhook] = addTodoReview.findings;
    if (!cache || !webhook) throw new Error('fixture');
    const text = buildReviewFixPlan(
      review,
      [webhook, { ...cache, fix: 'Add the call back.' }],
      [listFlow],
    );
    expect(text).toContain('# Fix plan: Todo lists');
    expect(text).toContain('`feature/todo-lists` was reviewed against `main`');
    expect(text.indexOf('[error]')).toBeLessThan(text.indexOf('[warning]'));
    expect(text).toContain('- Code: `backend/src/services/TodoService.ts:22`');
    expect(text).toContain('Add the call back.');
    expect(text).toMatch(/- Call: .* → .*: /);
    expect(text).not.toContain(addTodoReview.findings[2]?.title ?? '?');
  });
});

describe('buildImplementationPlan', () => {
  it('bär den dolda planen, bakgrunden och flödenas steg', () => {
    const text = buildImplementationPlan(document('1. Add a column'), [addFlow]);
    expect(text).toContain('## Plan\n\n1. Add a column');
    expect(text).toContain('## Background');
    expect(text).toContain('### Add todo (saved as `add-todo`)');
    expect(text).toContain('Steps:\n1. ');
  });

  it('visas bara för dokument som föreslår något', () => {
    expect(hasImplementationPlan(document(), [addFlow])).toBe(false);
    expect(hasImplementationPlan(document('1. Add a column'), [addFlow])).toBe(true);
  });
});
