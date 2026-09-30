import { describe, expect, it } from 'vitest';
import { asRecord, errorMessage, isRecord } from './json';

describe('json', () => {
  it('skiljer objekt från listor och null', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(asRecord('x')).toEqual({});
  });

  it('läser texten ur vad som än kastades', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
  });
});
