import { describe, expect, it } from 'vitest';
import { defaultBaseBranch, defaultHeadBranch } from './branches';

describe('defaultBaseBranch', () => {
  const branches = ['develop', 'feature/x', 'main'];

  it('behåller ett tidigare val som finns kvar och inte är den utcheckade', () => {
    expect(defaultBaseBranch(branches, 'feature/x', 'develop')).toBe('develop');
    expect(defaultBaseBranch(branches, 'develop', 'develop')).toBe('main');
  });

  it('föredrar main eller master', () => {
    expect(defaultBaseBranch(branches, 'feature/x', null)).toBe('main');
    expect(defaultBaseBranch(['master', 'topic'], 'topic', null)).toBe('master');
  });

  it('tar första andra branchen annars, och null om ingen finns', () => {
    expect(defaultBaseBranch(['a', 'b'], 'a', null)).toBe('b');
    expect(defaultBaseBranch(['main'], 'main', null)).toBeNull();
  });
});

describe('defaultHeadBranch', () => {
  it('behåller ett tidigare val som finns kvar, annars den utcheckade', () => {
    expect(defaultHeadBranch(['main', 'topic'], 'main', 'topic')).toBe('topic');
    expect(defaultHeadBranch(['main', 'topic'], 'main', 'gone')).toBe('main');
    expect(defaultHeadBranch(['main'], null, null)).toBe('main');
    expect(defaultHeadBranch([], null, null)).toBeNull();
  });
});
