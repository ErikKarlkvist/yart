import { describe, expect, it } from 'vitest';
import { formatPayload } from './format';

describe('formatPayload', () => {
  it('lämnar ren text orörd', () => {
    expect(formatPayload('title, trimmad')).toBe('title, trimmad');
  });

  it('bryter upp ett objekt', () => {
    expect(formatPayload('{ "title": "Handla mjölk", "done": false }')).toBe(
      '{\n  "title": "Handla mjölk",\n  "done": false\n}',
    );
  });

  it('behåller prefix som statuskod', () => {
    expect(formatPayload('201 { "id": 7 }')).toBe('201 {\n  "id": 7\n}');
  });

  it('klarar nästlade listor och ofullständig JSON', () => {
    expect(formatPayload('[ { "id": 7, "title": "…", … } ]')).toBe(
      '[\n  {\n    "id": 7,\n    "title": "…",\n    …\n  }\n]',
    );
  });

  it('rör inte kommatecken inuti strängar', () => {
    expect(formatPayload('{ "text": "a, b" }')).toBe('{\n  "text": "a, b"\n}');
  });

  it('håller tomma objekt på en rad', () => {
    expect(formatPayload('{ "items": [] }')).toBe('{\n  "items": []\n}');
  });
});
