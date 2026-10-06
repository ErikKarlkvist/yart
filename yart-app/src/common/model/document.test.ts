import { describe, expect, it } from 'vitest';
import { applyDocumentPatch } from './document';
import { validateDocument } from './document';

const document = {
  title: 'Seat availability',
  summary: 'The web app asks the API for open seats and combines the result with current bookings.',
  content:
    'The seating page sends the selected date to the availability API.\n\nThe API loads bookings and returns the remaining seats.',
  flows: ['get-seat-availability'],
};

describe('validateDocument', () => {
  it('accepts a concise overview with links to flows by name', () => {
    expect(validateDocument(document)).toMatchObject({ ok: true, document });
  });

  it('defaults to no linked flows', () => {
    const { flows: _flows, ...rest } = document;
    expect(validateDocument(rest)).toMatchObject({ ok: true, document: { flows: [] } });
  });

  it('rejects flow links that are not plain names', () => {
    const result = validateDocument({ ...document, flows: ['../../private.json'] });
    expect(result).toMatchObject({ ok: false });
  });
});

describe('applyDocumentPatch', () => {
  const doc = {
    title: 'Plan',
    summary: 'Due dates.',
    content: '## Goal\n\nAdd due dates.\n\n## Steps\n\n- Add a column',
    plan: '1. Migrate',
    flows: [],
  };

  it('byter exakt text och behåller resten', () => {
    const result = applyDocumentPatch(doc, {
      title: 'Plan v2',
      edits: [
        { field: 'content', oldText: '- Add a column', newText: '- Add a column\n- Show it' },
        { field: 'plan', oldText: '1. Migrate', newText: '1. Migrate\n2. Render' },
      ],
    });
    expect(result).toEqual({
      ok: true,
      document: {
        ...doc,
        title: 'Plan v2',
        content: '## Goal\n\nAdd due dates.\n\n## Steps\n\n- Add a column\n- Show it',
        plan: '1. Migrate\n2. Render',
      },
    });
  });

  it('lägger till ett avsnitt sist', () => {
    const result = applyDocumentPatch(doc, { edits: [], append: '## Risks\n\n- Time zones' });
    expect(
      result.ok && result.document.content.endsWith('- Add a column\n\n## Risks\n\n- Time zones'),
    ).toBe(true);
  });

  it('avvisar text som saknas eller finns flera gånger', () => {
    const result = applyDocumentPatch(
      { ...doc, content: 'a a' },
      {
        edits: [
          { field: 'content', oldText: 'a', newText: 'b' },
          { field: 'content', oldText: 'zzz', newText: 'b' },
        ],
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('appears 2 times');
    expect(result.errors[1]).toContain('was not found');
  });

  it('tar inte $-mönster i ersättningen som specialtecken', () => {
    const result = applyDocumentPatch(doc, {
      edits: [{ field: 'content', oldText: 'Add due dates.', newText: "Costs $& and $'" }],
    });
    expect(result.ok && result.document.content).toContain("Costs $& and $'");
  });
});
