import { describe, expect, it } from 'vitest';
import { validateDocument } from './document';

const document = {
  title: 'Seat availability',
  summary: 'The web app asks the API for open seats and combines the result with current bookings.',
  content:
    'The seating page sends the selected date to the availability API.\n\nThe API loads bookings and returns the remaining seats.',
  flowFiles: ['.reverik/flows/get-seat-availability.json'],
};

describe('validateDocument', () => {
  it('accepts a concise overview with links to flow files', () => {
    expect(validateDocument(document)).toMatchObject({ ok: true, document });
  });

  it('rejects flow links that leave the flow inbox', () => {
    const result = validateDocument({ ...document, flowFiles: ['../../private.json'] });
    expect(result).toMatchObject({ ok: false });
  });
});
