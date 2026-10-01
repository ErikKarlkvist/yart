import { delimiter } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withAgentPath } from './env';

describe('withAgentPath', () => {
  it('preserves a Windows-style Path without adding a conflicting PATH', () => {
    const original = ['C:/Windows/System32', 'C:/Users/test/AppData/Roaming/npm'].join(delimiter);
    const env = withAgentPath({ Path: original, APPDATA: 'C:/Users/test/AppData/Roaming' });

    expect(Object.keys(env).filter((key) => key.toLowerCase() === 'path')).toEqual(['Path']);
    expect(env.Path?.startsWith(original)).toBe(true);
  });
});
