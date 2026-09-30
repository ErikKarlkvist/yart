import { describe, expect, it } from 'vitest';
import { addTodoFlow, demoFlows } from './fixtures';
import { type Flow, type NodeKind, nodeKindSchema, validateFlow } from './flow';

function errorsOf(input: unknown): string[] {
  const result = validateFlow(input);
  return result.ok ? [] : result.errors;
}

describe('fixturer', () => {
  for (const flow of demoFlows) {
    it(`${flow.title} validerar`, () => {
      expect(validateFlow(flow)).toEqual({ ok: true, flow });
    });
  }

  it('täcker tillsammans alla nodtyper utom queue', () => {
    const kinds = new Set<NodeKind>(demoFlows.flatMap((f) => f.nodes.map((n) => n.kind)));
    for (const kind of nodeKindSchema.options) {
      if (kind !== 'queue') expect(kinds).toContain(kind);
    }
  });
});

describe('validateFlow', () => {
  const base: Flow = addTodoFlow;

  it('allows proposed new nodes and calls without invented source references', () => {
    const firstNode = base.nodes[0];
    const firstEdge = base.edges[0];
    if (!firstNode || !firstEdge) throw new Error('fixture is missing a node or edge');
    const { source: _nodeSource, ...node } = firstNode;
    const { source: _edgeSource, ...edge } = firstEdge;
    const flow = {
      ...base,
      nodes: [{ ...node, highlight: 'added' as const }, ...base.nodes.slice(1)],
      edges: [{ ...edge, highlight: 'added' as const }, ...base.edges.slice(1)],
    };
    expect(validateFlow(flow).ok).toBe(true);
    expect(errorsOf({ ...flow, edges: [{ ...edge }, ...base.edges.slice(1)] })).toContainEqual(
      expect.stringContaining('must have a source reference'),
    );
  });

  it('avvisar kant som pekar på okänd nod', () => {
    const flow = { ...base, edges: [{ ...base.edges[0], to: 'finns-inte' }] };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('unknown node "finns-inte"'));
  });

  it('avvisar nod som tillhör okänt system', () => {
    const [first, ...rest] = base.nodes;
    const flow = { ...base, nodes: [{ ...first, system: 'mars' }, ...rest] };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('unknown system "mars"'));
  });

  it('avvisar system som ingen nod tillhör', () => {
    const flow = {
      ...base,
      systems: [...base.systems, { id: 'mars', kind: 'external', label: 'Mars' }],
    };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('"mars" has no nodes'));
  });

  it('avvisar kant som rör tabell som inte finns på målnoden', () => {
    const insert = base.edges.find((e) => e.id === 'insert');
    if (!insert) throw new Error('fixturen saknar insert');
    const flow = {
      ...base,
      edges: base.edges.map((e) => (e.id === 'insert' ? { ...e, tables: ['orders'] } : e)),
    };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('table "orders"'));
  });

  it('avvisar kolumn som refererar okänd tabell', () => {
    const flow = {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === 'postgres'
          ? {
              ...n,
              tables: n.tables?.map((tbl) =>
                tbl.name === 'todos'
                  ? {
                      ...tbl,
                      columns: tbl.columns?.map((c) =>
                        c.name === 'list_id'
                          ? { ...c, references: { table: 'nope', column: 'id' } }
                          : c,
                      ),
                    }
                  : tbl,
              ),
            }
          : n,
      ),
    };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('unknown table "nope"'));
  });

  it('avvisar steg som pekar på okänd kant', () => {
    const flow = { ...base, steps: [{ edgeId: 'nope', description: 'x' }] };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('unknown edge "nope"'));
  });

  it('avvisar dubbla id:n', () => {
    const [first] = base.nodes;
    const flow = { ...base, nodes: [...base.nodes, { ...first }] };
    expect(errorsOf(flow)).toContainEqual(expect.stringContaining('more than once'));
  });

  it('kräver källhänvisning på kod i repot men inte på db, cache och externa system', () => {
    const [form] = base.nodes;
    const withoutSource = { ...form, source: undefined };
    expect(errorsOf({ ...base, nodes: [withoutSource, ...base.nodes.slice(1)] })).toContainEqual(
      expect.stringContaining('must have a source reference'),
    );
    for (const kind of ['db', 'cache', 'external'] as const) {
      expect(base.nodes.find((n) => n.kind === kind)?.source).toBeUndefined();
    }
  });

  it('ger läsbara fel med sökväg', () => {
    const errors = errorsOf({ ...base, edges: [] });
    expect(errors[0]).toMatch(/^edges: /);
  });

  it('avvisar skräp', () => {
    expect(validateFlow(null).ok).toBe(false);
    expect(validateFlow({}).ok).toBe(false);
  });
});
