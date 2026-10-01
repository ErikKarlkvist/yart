import { describe, expect, it } from 'vitest';
import {
  addTodoFlow,
  addTodoWithListCompare,
  addTodoWithListFlow,
  toggleTodoFlow,
} from '@/common/model/fixtures';
import { diffFlows, mergeForReview } from '@/common/model/review';
import { resolveSteps } from '@/common/model/steps';
import { buildSequence } from './sequence';

describe('buildSequence', () => {
  it('visar interna anrop som öglor på systemets livlinje', () => {
    const sequence = buildSequence(addTodoFlow, { kind: 'system' }, undefined, new Map());
    expect(sequence.participants.map((p) => p.node.id)).toEqual([
      'frontend',
      'backend',
      'postgres',
      'redis',
      'webhook',
    ]);
    // Alla steg spelas, även de som stannar inom ett system
    expect(sequence.steps).toHaveLength(addTodoFlow.steps.length);
    const submit = sequence.messages.find((m) => m.edge.id === 'submit');
    expect(submit?.self).toBe(true);
    expect(submit?.played).toBe(0);
  });

  it('ritar svar tillbaka till anroparen streckade', () => {
    const sequence = buildSequence(addTodoFlow, { kind: 'detail' }, undefined, new Map());
    const byEdge = new Map(sequence.messages.map((m) => [m.edge.id, m]));
    expect(byEdge.get('post')?.isReturn).toBe(false);
    expect(byEdge.get('respond')?.isReturn).toBe(true);
    expect(byEdge.get('set-state')?.isReturn).toBe(true);
  });

  it('ordnar deltagarna efter flödet, startpunkten först och systemens noder ihop', () => {
    const sequence = buildSequence(addTodoFlow, { kind: 'detail' }, undefined, new Map());
    expect(sequence.participants.map((p) => p.node.id)).toEqual([
      'add-form',
      'use-todos',
      'todos-api',
      'post-route',
      'todo-service',
      'todo-repository',
      'postgres',
      'todo-cache',
      'webhook',
    ]);
    const xs = sequence.participants.map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(sequence.bands.map((b) => b.systemId)).toContain('backend');
    expect(sequence.trigger?.label).toBe('User clicks Add');
  });

  it('ritar alla grenar men spelar bara de valda', () => {
    const sequence = buildSequence(toggleTodoFlow, { kind: 'detail' }, undefined, new Map());
    expect(sequence.fragments.map((f) => f.key)).toEqual(['3', '3.0.3']);
    expect(sequence.messages).toHaveLength(14);
    const notFound = sequence.messages.find((m) => m.edge.id === 'not-found');
    expect(notFound?.played).toBeNull();
    expect(sequence.steps.map((s) => s.edgeId)).toEqual(
      resolveSteps(toggleTodoFlow.steps).map((s) => s.edgeId),
    );

    const [outer, inner] = sequence.fragments;
    expect(outer?.branches.map((b) => [b.label, b.played])).toEqual([
      ['Valid', true],
      ['Invalid', false],
    ]);
    // Det inre blocket ligger inuti det yttre
    if (!outer || !inner) throw new Error('fragments missing');
    expect(inner.x).toBeGreaterThan(outer.x);
    expect(inner.x + inner.width).toBeLessThan(outer.x + outer.width);
    expect(inner.y).toBeGreaterThan(outer.y);
    expect(inner.y + inner.height).toBeLessThan(outer.y + outer.height);
  });

  it('spelar den valda grenen', () => {
    const sequence = buildSequence(
      toggleTodoFlow,
      { kind: 'system' },
      undefined,
      new Map([['3', 1]]),
    );
    const played = sequence.messages.filter((m) => m.played !== null).map((m) => m.edge.id);
    expect(played).toEqual(['toggle', 'update', 'patch', 'bad-request', 'reject']);
    expect(sequence.fragments.find((f) => f.key === '3.0.3')?.played).toBe(false);
  });

  it('lägger borttagna anrop i en review som spöken efter steget före dem i base', () => {
    const { base } = addTodoWithListCompare;
    const diff = diffFlows(base, addTodoWithListFlow);
    const merged = mergeForReview(addTodoWithListFlow, base, diff);
    const removedEdgeIds = new Set(
      [...diff.edges].filter(([, change]) => change === 'removed').map(([id]) => id),
    );
    const sequence = buildSequence(merged, { kind: 'detail' }, { diff, findings: [] }, new Map(), {
      baseSteps: resolveSteps(base.steps),
      removedEdgeIds,
    });
    const ghosts = sequence.messages.filter((m) => m.removed);
    expect(ghosts.map((m) => m.edge.id)).toEqual(['invalidate']);
    expect(ghosts.every((m) => m.played === null)).toBe(true);
  });
});
