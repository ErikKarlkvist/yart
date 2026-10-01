import { describe, expect, it } from 'vitest';
import { filterOptions } from './search';

describe('filterOptions', () => {
  const branches = ['main', 'polish', 'feature/todo-lists', 'listing', 'fix/list-cache'];

  it('returnerar allt utan sökfras', () => {
    expect(filterOptions(branches, '')).toEqual(branches);
  });

  it('rankar prefix före segmentstart före innehåll', () => {
    expect(filterOptions(branches, 'lis')).toEqual([
      'listing',
      'feature/todo-lists',
      'fix/list-cache',
      'polish',
    ]);
  });

  it('är skiftlägesokänslig och kapar listan', () => {
    expect(filterOptions(branches, 'FEAT', 1)).toEqual(['feature/todo-lists']);
  });

  it('ger tom lista utan träff', () => {
    expect(filterOptions(branches, 'xyz')).toEqual([]);
  });
});
