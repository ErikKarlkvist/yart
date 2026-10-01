import { describe, expect, it } from 'vitest';
import { addTodoFlow, listTodosFlow } from '@/common/model/fixtures';
import { buildModel, groupEdges, visualEdgeId } from './graph';
import { layoutFlow, NODE_SIZES } from './layout';

describe('layoutFlow', () => {
  const detail = buildModel(addTodoFlow, { kind: 'detail' });

  it('ger varje nod en position', () => {
    const { positions } = layoutFlow(detail);
    expect(positions.size).toBe(detail.nodes.length);
    for (const p of positions.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it('lägger UI till vänster om backend', () => {
    const { positions } = layoutFlow(detail);
    const form = positions.get('add-form');
    const db = positions.get('table:postgres:todos');
    expect(form && db && form.x + NODE_SIZES.node.width <= db.x).toBe(true);
  });

  it('markerar svar som bakåtriktade', () => {
    const { placements } = layoutFlow(detail);
    expect(placements.get('post')?.direction).toBe('forward');
    expect(placements.get('respond')?.direction).toBe('backward');
  });

  it('förskjuter linjerna fram och tillbaka mellan samma noder', () => {
    const model = buildModel(listTodosFlow, { kind: 'detail' });
    const { placements } = layoutFlow({ ...model, edges: groupEdges(model.edges) });
    const forward = placements.get(visualEdgeId('todos-api', 'get-route'))?.offset ?? 0;
    const back = placements.get(visualEdgeId('get-route', 'todos-api'))?.offset ?? 0;
    expect(forward).not.toBe(back);
  });

  it('håller ihop grupper och lägger inte fristående system inuti dem', () => {
    const { positions, groupRects } = layoutFlow(detail);
    const backend = groupRects.get('backend');
    expect(backend).toBeDefined();
    if (!backend) return;
    for (const node of detail.nodes.filter((n) => n.systemId !== 'backend')) {
      const p = positions.get(node.id);
      if (!p) throw new Error(node.id);
      const size = NODE_SIZES[node.level];
      const inside =
        p.x + size.width > backend.x &&
        p.x < backend.x + backend.width &&
        p.y + size.height > backend.y &&
        p.y < backend.y + backend.height;
      expect(inside, `${node.id} ligger inuti backend-ramen`).toBe(false);
    }
  });

  it('klarar systemvyn med självkanter', () => {
    const system = buildModel(addTodoFlow, { kind: 'system' });
    const { positions } = layoutFlow(system);
    expect(positions.size).toBe(system.nodes.length);
    const frontend = positions.get('frontend');
    const backend = positions.get('backend');
    expect(frontend && backend && frontend.x < backend.x).toBe(true);
  });

  it('lägger en kort sidogren ovanför huvudflödet utifrån kopplingarna', () => {
    const { positions, placements } = layoutFlow({
      nodes: ['webshop', 'tps', 'swish', 'sql'].map((id) => ({
        id,
        level: 'system' as const,
        systemId: id,
      })),
      edges: [
        { id: 'webshop-tps', from: 'webshop', to: 'tps' },
        { id: 'tps-sql', from: 'tps', to: 'sql' },
        { id: 'webshop-swish', from: 'webshop', to: 'swish' },
        { id: 'swish-webshop', from: 'swish', to: 'webshop' },
      ],
      groups: [],
    });
    const webshop = positions.get('webshop');
    const tps = positions.get('tps');
    const swish = positions.get('swish');
    const sql = positions.get('sql');
    expect(webshop && tps && swish && sql).toBeTruthy();
    if (!webshop || !tps || !swish || !sql) return;
    expect(swish.x).toBe(webshop.x);
    expect(swish.y + NODE_SIZES.system.height).toBeLessThan(webshop.y);
    expect(webshop.x).toBeLessThan(tps.x);
    expect(tps.x).toBeLessThan(sql.x);
    expect(placements.get('webshop-swish')?.direction).toBe('up');
    expect(placements.get('swish-webshop')?.direction).toBe('down');
  });

  it('väljer nedåt när platsen ovanför upptas av en annan sidogren', () => {
    const { positions, placements } = layoutFlow({
      nodes: ['webshop', 'tps', 'sql', 'swish', 'paypal'].map((id) => ({
        id,
        level: 'system' as const,
        systemId: id,
      })),
      edges: [
        { id: 'webshop-tps', from: 'webshop', to: 'tps' },
        { id: 'tps-sql', from: 'tps', to: 'sql' },
        { id: 'webshop-swish', from: 'webshop', to: 'swish' },
        { id: 'webshop-paypal', from: 'webshop', to: 'paypal' },
      ],
      groups: [],
    });
    const webshop = positions.get('webshop');
    const swish = positions.get('swish');
    const paypal = positions.get('paypal');
    if (!webshop || !swish || !paypal) throw new Error('Missing system position');
    expect(swish.y + NODE_SIZES.system.height).toBeLessThan(webshop.y);
    expect(paypal.y).toBeGreaterThan(webshop.y + NODE_SIZES.system.height);
    expect(placements.get('webshop-paypal')?.direction).toBe('down');
  });

  it('rätar ut en direkt väg och centrerar en alternativ väg via TPS', () => {
    const { positions } = layoutFlow({
      nodes: ['webshop', 'tps', 'sql', 'swish'].map((id) => ({
        id,
        level: 'system' as const,
        systemId: id,
      })),
      edges: [
        { id: 'webshop-sql', from: 'webshop', to: 'sql' },
        { id: 'webshop-tps', from: 'webshop', to: 'tps' },
        { id: 'tps-sql', from: 'tps', to: 'sql' },
        { id: 'webshop-swish', from: 'webshop', to: 'swish' },
      ],
      groups: [],
    });
    const webshop = positions.get('webshop');
    const tps = positions.get('tps');
    const sql = positions.get('sql');
    if (!webshop || !tps || !sql) throw new Error('Missing system position');
    expect(webshop.y).toBe(sql.y);
    expect(tps.x).toBe((webshop.x + sql.x) / 2);
    expect(tps.y + NODE_SIZES.system.height).toBeLessThan(webshop.y);
  });

  it('behåller en ensam slutpunkt i ett rakt flöde till höger', () => {
    const { positions, placements } = layoutFlow({
      nodes: ['webshop', 'api', 'database'].map((id) => ({
        id,
        level: 'system' as const,
        systemId: id,
      })),
      edges: [
        { id: 'webshop-api', from: 'webshop', to: 'api' },
        { id: 'api-database', from: 'api', to: 'database' },
      ],
      groups: [],
    });
    const webshop = positions.get('webshop');
    const api = positions.get('api');
    const database = positions.get('database');
    if (!webshop || !api || !database) throw new Error('Missing system position');
    expect(webshop.x).toBeLessThan(api.x);
    expect(api.x).toBeLessThan(database.x);
    expect(placements.get('api-database')?.direction).toBe('forward');
  });
});
