import { describe, expect, it } from 'vitest';
import { combinedHighlight, edgeHighlight } from './highlight';

describe('flow highlights', () => {
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
