import { describe, expect, it } from 'vitest';
import { listTodosFlow, toggleTodoFlow } from './fixtures';
import { allSteps, choicesFor, choicesForBranch, playedAlts, resolveSteps } from './steps';

const edges = (steps: readonly { edgeId: string }[]): string[] => steps.map((s) => s.edgeId);

describe('resolveSteps', () => {
  it('spelar första grenen när inget valts', () => {
    expect(edges(resolveSteps(listTodosFlow.steps))).toEqual([
      'fetch',
      'get',
      'route-to-service',
      'cache-get',
      'find-all',
      'select',
      'cache-set',
      'respond',
    ]);
  });

  it('följer valda grenar, även en tom', () => {
    expect(edges(resolveSteps(listTodosFlow.steps, new Map([['4', 1]])))).toEqual([
      'fetch',
      'get',
      'route-to-service',
      'cache-get',
      'respond',
    ]);
  });

  it('väljer grenar i nästlade alternativ', () => {
    const notFound = resolveSteps(toggleTodoFlow.steps, choicesForBranch('3.0.3', 1));
    expect(edges(notFound).slice(-3)).toEqual(['update-row', 'not-found', 'reject']);
    const invalid = resolveSteps(toggleTodoFlow.steps, new Map([['3', 1]]));
    expect(edges(invalid)).toEqual(['toggle', 'update', 'patch', 'bad-request', 'reject']);
  });

  it('ger samma stegobjekt som i flödet', () => {
    expect(resolveSteps(toggleTodoFlow.steps)[0]).toBe(toggleTodoFlow.steps[0]);
  });
});

describe('alternativ', () => {
  it('allSteps tar med alla grenar', () => {
    expect(allSteps(toggleTodoFlow.steps)).toHaveLength(14);
  });

  it('playedAlts hoppar över alternativ i grenar som inte spelas', () => {
    expect(playedAlts(toggleTodoFlow.steps, new Map()).map((a) => a.key)).toEqual(['3', '3.0.3']);
    expect(playedAlts(toggleTodoFlow.steps, new Map([['3', 1]])).map((a) => a.key)).toEqual(['3']);
  });

  it('choicesForBranch väljer även grenarna utanför', () => {
    expect([...choicesForBranch('3.0.3', 1)]).toEqual([
      ['3', 0],
      ['3.0.3', 1],
    ]);
  });

  it('choicesFor hittar vägen till ett steg', () => {
    const notFound = allSteps(toggleTodoFlow.steps).find((s) => s.edgeId === 'not-found');
    expect(notFound).toBeDefined();
    if (!notFound) return;
    expect([...(choicesFor(toggleTodoFlow.steps, notFound) ?? [])]).toEqual([
      ['3', 0],
      ['3.0.3', 1],
    ]);
  });
});
