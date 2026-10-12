import { describe, expect, it } from 'vitest';
import { reorderTabs } from './tabOrder';

describe('reorderTabs', () => {
  it('moves tabs left and right using gaps in the original list', () => {
    expect(reorderTabs([1, 2, 3, 4], 3, 0)).toEqual([3, 1, 2, 4]);
    expect(reorderTabs([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
    expect(reorderTabs([1, 2, 3, 4], 2, 4)).toEqual([1, 3, 4, 2]);
  });

  it('leaves both gaps beside a tab unchanged and ignores missing tabs', () => {
    const ids = [1, 2, 3];
    expect(reorderTabs(ids, 2, 1)).toBe(ids);
    expect(reorderTabs(ids, 2, 2)).toBe(ids);
    expect(reorderTabs(ids, 9, 0)).toBe(ids);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('keeps tabs at the edges when moving beyond the list', () => {
    expect(reorderTabs([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(reorderTabs([1, 2, 3], 2, 10)).toEqual([1, 3, 2]);
    expect(reorderTabs([1], 1, 1)).toEqual([1]);
  });
});
