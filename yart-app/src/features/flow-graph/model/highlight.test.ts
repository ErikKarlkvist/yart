import { describe, expect, it } from 'vitest';
import { combinedHighlight, edgeHighlight } from './highlight';

describe('flow highlights', () => {
  it('marks problems without a review and preserves them over compared changes', () => {
    expect(edgeHighlight(undefined, [], 'problem')).toBe('problem');
    expect(edgeHighlight('changed', [], 'problem')).toBe('problem');
    expect(
      edgeHighlight(
        'added',
        [{ id: 'w', severity: 'warning', title: 'Risk', description: 'Risk' }],
        'problem',
      ),
    ).toBe('problem');
    expect(combinedHighlight(['added', 'problem', 'warning'])).toBe('problem');
    expect(edgeHighlight(undefined, [], 'added')).toBe('added');
  });
  it('prioritizes review problems over proposed or compared changes', () => {
    expect(
      edgeHighlight('added', [
        { id: 'f', severity: 'error', title: 'Broken', description: 'Fails' },
      ]),
    ).toBe('problem');
    expect(combinedHighlight(['added', 'warning', 'changed'])).toBe('warning');
    expect(edgeHighlight('changed', [])).toBe('changed');
  });
});
