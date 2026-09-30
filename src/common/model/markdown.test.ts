import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('delar upp rubriker, listor och stycken', () => {
    const blocks = parseMarkdown(
      '## What changes\n- Form gets a **list picker**\n- Route validates `listId`\n\n1. First\n2. Second\n\nA short\nparagraph.',
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, content: [{ kind: 'text', text: 'What changes' }] },
      {
        kind: 'list',
        ordered: false,
        items: [
          [
            { kind: 'text', text: 'Form gets a ' },
            { kind: 'strong', text: 'list picker' },
          ],
          [
            { kind: 'text', text: 'Route validates ' },
            { kind: 'code', text: 'listId' },
          ],
        ],
      },
      {
        kind: 'list',
        ordered: true,
        items: [[{ kind: 'text', text: 'First' }], [{ kind: 'text', text: 'Second' }]],
      },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'A short paragraph.' }] },
    ]);
  });

  it('läser gamla texter med bara stycken', () => {
    expect(parseMarkdown('One.\n\nTwo.').map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('låter en indragen rad fortsätta listpunkten', () => {
    const [list] = parseMarkdown('- First line\n  continues here');
    expect(list).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        [
          { kind: 'text', text: 'First line' },
          { kind: 'text', text: ' continues here' },
        ],
      ],
    });
  });
});

describe('parseInline', () => {
  it('lämnar omatchade tecken som text', () => {
    expect(parseInline('a ** b ` c')).toEqual([{ kind: 'text', text: 'a ** b ` c' }]);
  });
});
