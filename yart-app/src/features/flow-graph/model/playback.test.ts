import { describe, expect, it } from 'vitest';
import { addTodoFlow } from '@/common/model/fixtures';
import { clampStep, stepView } from './playback';

describe('stepView', () => {
  it('inget steg ger allt pending', () => {
    const view = stepView(addTodoFlow, -1);
    expect([...view.edges.values()].every((s) => s === 'pending')).toBe(true);
    expect(view.activeEdgeId).toBeNull();
  });

  it('markerar aktiv kant och tidigare som klara', () => {
    const view = stepView(addTodoFlow, 2);
    expect(view.activeEdgeId).toBe('post');
    expect(view.edges.get('submit')).toBe('done');
    expect(view.edges.get('create')).toBe('done');
    expect(view.edges.get('post')).toBe('active');
    expect(view.edges.get('respond')).toBe('pending');
  });

  it('aktiva noder är kantens ändar', () => {
    const view = stepView(addTodoFlow, 2);
    expect(view.nodes.get('todos-api')).toBe('active');
    expect(view.nodes.get('post-route')).toBe('active');
    expect(view.nodes.get('add-form')).toBe('done');
    expect(view.nodes.get('postgres')).toBe('pending');
  });
});

describe('clampStep', () => {
  it('håller sig inom listan', () => {
    expect(clampStep(-5, 3)).toBe(0);
    expect(clampStep(10, 3)).toBe(2);
    expect(clampStep(1, 0)).toBe(-1);
  });
});
