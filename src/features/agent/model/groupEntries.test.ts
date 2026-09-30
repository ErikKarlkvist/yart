import { describe, expect, it } from 'vitest';
import { groupEntries } from './groupEntries';

const at = '2026-09-30T10:00:00Z';

describe('groupEntries', () => {
  it('slår ihop verktygsanrop i följd och lämnar meddelanden för sig', () => {
    const groups = groupEntries([
      { at, kind: 'user', text: 'Hej' },
      { at, kind: 'tool', name: 'Bash' },
      { at, kind: 'tool', name: 'Read' },
      { at, kind: 'assistant', text: 'Klart' },
      { at, kind: 'tool', name: 'save_flow' },
    ]);
    expect(groups.map((g) => (g.kind === 'tools' ? g.tools.map((t) => t.name) : g.kind))).toEqual([
      'entry',
      ['Bash', 'Read'],
      'entry',
      ['save_flow'],
    ]);
  });

  it('behåller nyckeln när en grupp växer', () => {
    const one = groupEntries([{ at, kind: 'tool', name: 'Bash' }]);
    const two = groupEntries([
      { at, kind: 'tool', name: 'Bash' },
      { at, kind: 'tool', name: 'Read' },
    ]);
    expect(two[0]?.key).toBe(one[0]?.key);
  });
});
