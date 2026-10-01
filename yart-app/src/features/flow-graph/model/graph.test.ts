import { describe, expect, it } from 'vitest';
import {
  addTodoFlow,
  addTodoReview,
  addTodoWithListCompare,
  addTodoWithListFlow,
  listTodosFlow,
} from '@/common/model/fixtures';
import { diffFlows, mergeForReview } from '@/common/model/review';
import { buildModel, groupEdges, hideElements, mapStepIndex } from './graph';

describe('buildModel', () => {
  it('systemvyn har en nod per system och kanterna pekar på system', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    expect(model.nodes.map((n) => n.id)).toEqual(addTodoFlow.systems.map((s) => s.id));
    expect(model.nodes.every((n) => n.level === 'system')).toBe(true);
    const post = model.edges.find((e) => e.id === 'post');
    expect(post).toMatchObject({ from: 'frontend', to: 'backend' });
    // Kant-id:n är orörda, men bara steg mellan system spelas upp
    expect(model.edges.map((e) => e.id)).toEqual(addTodoFlow.edges.map((e) => e.id));
    expect(model.steps.map((s) => s.edgeId)).toEqual([
      'post',
      'insert',
      'invalidate',
      'notify',
      'respond',
    ]);
  });

  it('ritar inte system som saknar noder', () => {
    const flow = {
      ...addTodoFlow,
      systems: [...addTodoFlow.systems, { id: 'mars', kind: 'external' as const, label: 'Mars' }],
    };
    const model = buildModel(flow, { kind: 'system' });
    expect(model.nodes.map((n) => n.id)).not.toContain('mars');
  });

  it('samlar tabeller med anropen som rör dem, även på systemnivå', () => {
    const system = buildModel(addTodoFlow, { kind: 'system' });
    const postgres = system.nodes.find((n) => n.id === 'postgres');
    expect(postgres?.tables.map((t) => t.name)).toEqual(['lists', 'todos']);
    const todos = postgres?.tables.find((t) => t.name === 'todos');
    expect(todos?.touchedBy.map((t) => t.edgeId)).toEqual(['insert']);
    expect(todos?.columns?.map((c) => c.name)).toContain('created_at');
    const frontend = system.nodes.find((n) => n.id === 'frontend');
    expect(frontend?.tables).toEqual([]);
  });

  it('interna anrop blir självkanter i systemvyn', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    const internal = model.edges.find((e) => e.id === 'route-to-service');
    expect(internal).toMatchObject({ from: 'backend', to: 'backend' });
  });

  it('fokus på ett system visar dess noder och de andra som system', () => {
    const model = buildModel(addTodoFlow, { kind: 'focus', systemId: 'backend' });
    const backendNodes = model.nodes.filter((n) => n.systemId === 'backend');
    expect(backendNodes.every((n) => n.level === 'node')).toBe(true);
    expect(backendNodes.map((n) => n.id)).toEqual([
      'post-route',
      'todo-service',
      'todo-repository',
    ]);
    expect(model.nodes.find((n) => n.id === 'frontend')?.level).toBe('system');
    expect(model.edges.find((e) => e.id === 'post')).toMatchObject({
      from: 'frontend',
      to: 'post-route',
    });
    expect(model.groups.map((g) => g.id)).toEqual(['backend']);
  });

  it('fokus spelar upp stegen i systemet och över gränsen, inte andras interna', () => {
    const model = buildModel(addTodoFlow, { kind: 'focus', systemId: 'backend' });
    expect(model.steps.map((s) => s.edgeId)).toEqual([
      'post',
      'route-to-service',
      'service-to-repo',
      'insert',
      'invalidate',
      'notify',
      'respond',
    ]);
  });

  it('inzoomad databas visar tabeller som noder med relationer', () => {
    const model = buildModel(addTodoFlow, { kind: 'focus', systemId: 'postgres' });
    const tables = model.nodes.filter((n) => n.level === 'table');
    expect(tables.map((n) => n.label)).toEqual(['lists', 'todos']);
    expect(model.nodes.find((n) => n.id === 'postgres')).toBeUndefined();
    expect(model.relations).toEqual([
      {
        id: 'relation:postgres:todos.list_id',
        from: 'table:postgres:todos',
        to: 'table:postgres:lists',
        label: 'list_id → id',
      },
    ]);
    // Insert-anropet pekar på tabellen todos, inte på databasnoden
    expect(model.edges.find((e) => e.id === 'insert')?.to).toBe('table:postgres:todos');
    expect(model.groups.map((g) => g.id)).toEqual(['postgres']);
  });

  it('detaljvyn har alla noder, alla steg och en grupp per system med noder', () => {
    const model = buildModel(addTodoFlow, { kind: 'detail' });
    // Postgres-noden ersätts av sina två tabeller, Redis-noden av sin nyckel
    expect(model.nodes).toHaveLength(addTodoFlow.nodes.length + 1);
    expect(model.steps).toHaveLength(addTodoFlow.steps.length);
    expect(model.groups).toHaveLength(addTodoFlow.systems.length);
  });
});

describe('mapStepIndex', () => {
  const system = buildModel(addTodoFlow, { kind: 'system' });
  const detail = buildModel(addTodoFlow, { kind: 'detail' });

  it('behåller samma steg när det finns i båda vyerna', () => {
    // 'insert' är steg 5 i detaljvyn (index 5) och steg 1 i systemvyn
    expect(mapStepIndex(addTodoFlow, detail, 5, system)).toBe(1);
    expect(mapStepIndex(addTodoFlow, system, 1, detail)).toBe(5);
  });

  it('faller tillbaka på närmast föregående steg', () => {
    // 'route-to-service' (index 3 i detalj) är internt, närmast före i systemvyn är 'post'
    expect(mapStepIndex(addTodoFlow, detail, 3, system)).toBe(0);
  });

  it('börjar från början om inget tidigare steg finns', () => {
    // 'submit' (index 0) är internt och inget systemsteg ligger före
    expect(mapStepIndex(addTodoFlow, detail, 0, system)).toBe(0);
  });
});

describe('groupEdges', () => {
  it('ritar alla anrop samma väg som en linje och svar som en linje tillbaka', () => {
    const model = buildModel(listTodosFlow, { kind: 'detail' });
    const visual = groupEdges(model.edges);
    const toCache = visual.find(
      (v) => v.from === 'todo-service' && v.to === 'table:todo-cache:todos:all',
    );
    expect(toCache?.members.map((m) => m.id)).toEqual(['cache-get', 'cache-set']);
    const forward = visual.find((v) => v.from === 'todos-api' && v.to === 'get-route');
    const back = visual.find((v) => v.from === 'get-route' && v.to === 'todos-api');
    expect(forward?.members.map((m) => m.id)).toEqual(['get']);
    expect(back?.members.map((m) => m.id)).toEqual(['respond']);
  });

  it('hoppar över självkanter', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    expect(groupEdges(model.edges).every((v) => v.from !== v.to)).toBe(true);
  });
});

describe('hideElements', () => {
  it('döljer noden, dess kanter och stegen som spelar upp dem', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    const hidden = hideElements(model, new Set(['webhook']), new Set());
    expect(hidden.nodes.some((n) => n.id === 'webhook')).toBe(false);
    expect(hidden.edges.some((e) => e.to === 'webhook')).toBe(false);
    expect(hidden.steps.map((s) => s.edgeId)).toEqual(['post', 'insert', 'invalidate', 'respond']);
    // Samma stegobjekt som i modellen, så uppspelningen kan mappa mellan vyer
    expect(model.steps).toContain(hidden.steps[0]);
  });

  it('ett dolt system döljer dess noder och tabeller i detaljvyn', () => {
    const model = buildModel(addTodoFlow, { kind: 'detail' });
    const hidden = hideElements(model, new Set(['postgres']), new Set());
    expect(hidden.nodes.some((n) => n.systemId === 'postgres')).toBe(false);
    expect(hidden.groups.some((g) => g.id === 'postgres')).toBe(false);
    expect(hidden.relations).toHaveLength(0);
  });

  it('en dold kant tar bara bort sitt steg', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    const hidden = hideElements(model, new Set(), new Set(['notify']));
    expect(hidden.nodes).toHaveLength(model.nodes.length);
    expect(hidden.steps.some((s) => s.edgeId === 'notify')).toBe(false);
  });

  it('returnerar samma modell när inget är dolt', () => {
    const model = buildModel(addTodoFlow, { kind: 'system' });
    expect(hideElements(model, new Set(), new Set())).toBe(model);
  });
});

describe('buildModel med review', () => {
  const diff = diffFlows(addTodoWithListCompare.base, addTodoWithListFlow);
  const merged = mergeForReview(addTodoWithListFlow, addTodoWithListCompare.base, diff);
  const annotations = { diff, findings: addTodoReview.findings };

  it('märker noder med ändring och fynd i detaljvyn', () => {
    const model = buildModel(merged, { kind: 'detail' }, annotations);
    expect(model.nodes.find((n) => n.id === 'list-repository')?.change).toBe('added');
    expect(model.nodes.find((n) => n.id === 'add-form')?.change).toBe('changed');
    expect(model.nodes.find((n) => n.id === 'webhook')?.change).toBeUndefined();
    expect(model.nodes.find((n) => n.id === 'todo-service')?.findings.map((f) => f.id)).toEqual([
      'cache-not-invalidated',
    ]);
  });

  it('systemet ärver sina noders ändringar och interna fynd', () => {
    const model = buildModel(merged, { kind: 'system' }, annotations);
    const backend = model.nodes.find((n) => n.id === 'backend');
    expect(backend?.change).toBe('changed');
    // Fyndet på det interna anropet check-list hamnar på systemet
    expect(backend?.findings.map((f) => f.id)).toContain('list-check-outside-transaction');
    expect(model.nodes.find((n) => n.id === 'redis')?.change).toBeUndefined();
  });

  it('utan review saknar noderna ändringar och fynd', () => {
    const model = buildModel(addTodoFlow, { kind: 'detail' });
    expect(model.nodes.every((n) => n.change === undefined && n.findings.length === 0)).toBe(true);
  });
});
