import { describe, expect, it } from 'vitest';
import { conversationInstructions } from './conversationInstructions';

describe('conversation instructions', () => {
  it('keeps review branches and required outputs in the background context', () => {
    const instructions = conversationInstructions('review', { head: 'feature/a', base: 'main' });
    expect(instructions).toContain('feature/a');
    expect(instructions).toContain('main');
    expect(instructions).toContain('save_review');
  });

  it('tells planning conversations to update a document and challenge assumptions', () => {
    const instructions = conversationInstructions('plan');
    expect(instructions).toContain('critical questions');
    expect(instructions).toContain('save_document');
  });

  it('asks every flow-producing mode for the trigger', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const)
      expect(conversationInstructions(mode, { head: 'a', base: 'b' })).toContain('trigger');
  });
});
