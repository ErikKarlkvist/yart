import { describe, expect, it } from 'vitest';
import {
  applyLayout,
  EMPTY_LAYOUT,
  isListLayout,
  type ListLayout,
  moveGroup,
  moveItem,
  renameGroup,
} from './listLayout';

interface Item {
  id: string;
}
interface Group {
  key: string;
  label: string;
  items: Item[];
}

const groups: Group[] = [
  { key: 'builtin', label: 'Built-in', items: [{ id: 'a' }, { id: 'b' }] },
  { key: 'conv', label: 'Lists', items: [{ id: 'c' }] },
];

function apply(layout: ListLayout, input = groups): Group[] {
  return applyLayout(layout, {
    groups: input,
    itemsOf: (g) => g.items,
    withItems: (g, items, label) => ({ ...g, items, label }),
  });
}

const shape = (list: Group[]): [string, string, string[]][] =>
  list.map((g) => [g.key, g.label, g.items.map((i) => i.id)]);

describe('applyLayout', () => {
  it('ändrar inget utan sparat', () => {
    expect(shape(apply(EMPTY_LAYOUT))).toEqual([
      ['builtin', 'Built-in', ['a', 'b']],
      ['conv', 'Lists', ['c']],
    ]);
  });

  it('ordnar grupper och objekt och sätter rubriker', () => {
    const layout: ListLayout = {
      groups: ['conv'],
      labels: { conv: 'Todo lists' },
      items: { builtin: ['b'] },
      moved: {},
    };
    expect(shape(apply(layout))).toEqual([
      ['conv', 'Todo lists', ['c']],
      ['builtin', 'Built-in', ['b', 'a']],
    ]);
  });

  it('flyttar objekt till en annan grupp, men inte till en som försvunnit', () => {
    const layout: ListLayout = { ...EMPTY_LAYOUT, moved: { a: 'conv', c: 'gone' } };
    expect(shape(apply(layout))).toEqual([
      ['builtin', 'Built-in', ['b']],
      ['conv', 'Lists', ['c', 'a']],
    ]);
  });
});

describe('moveItem', () => {
  it('ordnar om inom gruppen', () => {
    const next = moveItem(EMPTY_LAYOUT, 'a', 'builtin', 'builtin', ['a', 'b'], 2);
    expect(next.items).toEqual({ builtin: ['b', 'a'] });
    expect(next.moved).toEqual({});
  });

  it('noterar flytt till en annan grupp och tar bort den vid flytt hem', () => {
    const away = moveItem(EMPTY_LAYOUT, 'a', 'builtin', 'conv', ['c'], 0);
    expect(away.items).toEqual({ conv: ['a', 'c'] });
    expect(away.moved).toEqual({ a: 'conv' });
    const home = moveItem(away, 'a', 'builtin', 'builtin', ['b'], 1);
    expect(home.items).toEqual({ conv: ['c'], builtin: ['b', 'a'] });
    expect(home.moved).toEqual({});
  });
});

describe('moveGroup och renameGroup', () => {
  it('flyttar en grupp till luckan', () => {
    expect(moveGroup(EMPTY_LAYOUT, ['builtin', 'conv'], 'conv', 0).groups).toEqual([
      'conv',
      'builtin',
    ]);
    expect(moveGroup(EMPTY_LAYOUT, ['builtin', 'conv'], 'builtin', 2).groups).toEqual([
      'conv',
      'builtin',
    ]);
  });

  it('sätter och tar bort rubrik', () => {
    const named = renameGroup(EMPTY_LAYOUT, 'conv', '  Lists  ');
    expect(named.labels).toEqual({ conv: 'Lists' });
    expect(renameGroup(named, 'conv', ' ').labels).toEqual({});
  });
});

describe('isListLayout', () => {
  it('känner igen formen', () => {
    expect(isListLayout(EMPTY_LAYOUT)).toBe(true);
    expect(isListLayout({ groups: [1], labels: {}, items: {}, moved: {} })).toBe(false);
    expect(isListLayout(null)).toBe(false);
  });
});
