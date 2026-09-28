import { describe, expect, it } from 'vitest';
import {
  ADD_TODO_WITH_LIST_NAME,
  addTodoReview,
  addTodoWithListCompare,
  addTodoWithListFlow,
} from './fixtures/add-todo-review';
import { validateFlow } from './flow';
import {
  checkFindingTargets,
  diffFlows,
  findingLocation,
  flowCompareSchema,
  formatFindings,
  mergeForReview,
  reviewSchema,
  sortFindings,
  validateReview,
  worstSeverity,
} from './review';

const base = addTodoWithListCompare.base;
const lookup = (name: string): { flow: typeof addTodoWithListFlow; base?: typeof base } | null =>
  name === ADD_TODO_WITH_LIST_NAME ? { flow: addTodoWithListFlow, base } : null;

describe('review-fixturen', () => {
  it('validerar reviewn, jämförelsen och head-flödet mot schemana', () => {
    expect(reviewSchema.safeParse(addTodoReview).success).toBe(true);
    expect(flowCompareSchema.safeParse(addTodoWithListCompare).success).toBe(true);
    expect(validateFlow(addTodoWithListFlow).ok).toBe(true);
  });

  it('pekar bara på noder och kanter som finns i head eller base', () => {
    expect(checkFindingTargets(addTodoReview, lookup)).toEqual([]);
  });
});

describe('diffFlows', () => {
  const diff = diffFlows(base, addTodoWithListFlow);

  it('hittar tillagt, borttaget och ändrat', () => {
    expect(diff.nodes.get('list-repository')).toBe('added');
    expect(diff.edges.get('check-list')).toBe('added');
    expect(diff.edges.get('invalidate')).toBe('removed');
    expect(diff.edges.get('post')).toBe('changed');
    expect(diff.edges.get('respond')).toBeUndefined();
    expect(diff.nodes.get('webhook')).toBeUndefined();
  });

  it('är tom när flödena är lika', () => {
    const same = diffFlows(addTodoWithListFlow, addTodoWithListFlow);
    expect(same.nodes.size).toBe(0);
    expect(same.edges.size).toBe(0);
  });
});

describe('mergeForReview', () => {
  it('lägger till det borttagna utan att spela upp det', () => {
    const diff = diffFlows(base, addTodoWithListFlow);
    const merged = mergeForReview(addTodoWithListFlow, base, diff);
    expect(merged.edges.some((e) => e.id === 'invalidate')).toBe(true);
    expect(merged.steps).toBe(addTodoWithListFlow.steps);
    expect(validateFlow(merged).ok).toBe(true);
  });
});

describe('findings', () => {
  it('sorterar allvarligast först', () => {
    const sorted = sortFindings(addTodoReview.findings);
    expect(sorted[0]?.severity).toBe('error');
    expect(worstSeverity(addTodoReview.findings)).toBe('error');
    expect(worstSeverity([])).toBeNull();
  });
});

describe('validateReview', () => {
  it('kräver att fynd pekar på flöden i listan', () => {
    const result = validateReview({
      ...addTodoReview,
      findings: [{ ...addTodoReview.findings[0], flow: 'other' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('"other"');
  });

  it('kräver ett flöde när fyndet pekar på en nod', () => {
    const { flow: _flow, ...finding } = addTodoReview.findings[0] ?? { id: 'x' };
    const result = validateReview({ ...addTodoReview, findings: [finding] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('names no flow');
  });

  it('ger läsbara fel', () => {
    const result = validateReview({ baseLabel: 'main' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e: string) => e.startsWith('headLabel'))).toBe(true);
  });
});

describe('checkFindingTargets', () => {
  it('rapporterar flöden som inte är sparade och mål som saknas', () => {
    const errors = checkFindingTargets(
      {
        ...addTodoReview,
        flows: [ADD_TODO_WITH_LIST_NAME, 'missing'],
        findings: [
          { ...addTodoReview.findings[0], id: 'a', nodeId: 'ghost' },
          { ...addTodoReview.findings[1], id: 'b', edgeId: 'ghost-edge' },
        ],
      } as typeof addTodoReview,
      lookup,
    );
    expect(errors).toEqual([
      expect.stringContaining('"missing" is not saved'),
      expect.stringContaining('node "ghost"'),
      expect.stringContaining('call "ghost-edge"'),
    ]);
  });

  it('räknar borttagna noder i base som giltiga mål', () => {
    const errors = checkFindingTargets(
      {
        ...addTodoReview,
        findings: [
          { ...addTodoReview.findings[0], id: 'a', nodeId: undefined, edgeId: 'invalidate' },
        ],
      } as typeof addTodoReview,
      lookup,
    );
    expect(errors).toEqual([]);
  });
});

describe('formatFindings', () => {
  it('skriver en numrerad lista med plats, fil och förslag, allvarligast först', () => {
    const text = formatFindings(addTodoReview.findings.slice(0, 2).reverse(), (finding) =>
      findingLocation(finding, addTodoWithListFlow, base),
    );
    expect(text.split('\n')[0]).toBe(
      '1. [error] The cached list is no longer invalidated (TodoService.create, backend/src/services/TodoService.ts:22)',
    );
    expect(text).toContain(
      '2. [warning] The webhook is awaited inside the request (await POST webhook, ',
    );
    expect(text).toContain('   Suggestion: Call cache.invalidate()');
  });
});
