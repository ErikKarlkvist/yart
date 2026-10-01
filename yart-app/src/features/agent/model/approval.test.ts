import { describe, expect, it } from 'vitest';
import { describeApproval } from './approval';

describe('describeApproval', () => {
  it('visar kommandot eller filen agenten vill röra', () => {
    expect(describeApproval({ command: 'npm test' })).toBe('npm test');
    expect(describeApproval({ file_path: 'src/a.ts', old_string: 'x' })).toBe('src/a.ts');
  });

  it('kortar annan indata', () => {
    expect(describeApproval({ value: 'x'.repeat(300) }).endsWith('…')).toBe(true);
  });
});
