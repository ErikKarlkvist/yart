import { describe, expect, it } from 'vitest';
import { defineChannel } from './channel';

describe('defineChannel', () => {
  it('behåller kanalnamnet', () => {
    expect(defineChannel<{ id: string }, number>('test:ping').name).toBe('test:ping');
  });
});
