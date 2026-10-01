import { describe, expect, it } from 'vitest';
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
