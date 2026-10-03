import { describe, expect, it } from 'vitest';
import { answeredInput, describeApproval, parseQuestions } from './approval';

describe('describeApproval', () => {
  it('visar kommandot eller filen agenten vill röra', () => {
    expect(describeApproval({ command: 'npm test' })).toBe('npm test');
    expect(describeApproval({ file_path: 'src/a.ts', old_string: 'x' })).toBe('src/a.ts');
  });

  it('kortar annan indata', () => {
    expect(describeApproval({ value: 'x'.repeat(300) }).endsWith('…')).toBe(true);
  });
});

describe('AskUserQuestion', () => {
  const input = {
    questions: [
      {
        question: 'Which flow?',
        header: 'Flow',
        options: [{ label: 'Add todo', description: 'The form' }, { label: 'List' }],
        multiSelect: false,
      },
    ],
  };

  it('läser frågorna och alternativen', () => {
    expect(parseQuestions(input)).toEqual([
      {
        question: 'Which flow?',
        header: 'Flow',
        options: [
          { label: 'Add todo', description: 'The form' },
          { label: 'List', description: '' },
        ],
        multiSelect: false,
      },
    ]);
    expect(parseQuestions({ command: 'ls' })).toBeNull();
  });

  it('lägger svaren per frågetext i indata', () => {
    expect(answeredInput(input, { 'Which flow?': 'List' })).toEqual({
      ...input,
      answers: { 'Which flow?': 'List' },
    });
  });
});
