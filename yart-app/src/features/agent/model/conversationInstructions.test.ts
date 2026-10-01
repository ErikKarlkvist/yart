import { describe, expect, it } from 'vitest';
import { conversationInstructions, responseHint } from './conversationInstructions';

describe('conversation instructions', () => {
  it('keeps review branches and required outputs in the background context', () => {
    const instructions = conversationInstructions('review', { head: 'feature/a', base: 'main' });
    expect(instructions).toContain('feature/a');
    expect(instructions).toContain('main');
    expect(instructions).toContain('save_review');
  });

  it('lets planning conversations discuss before saving a requested document', () => {
    const instructions = conversationInstructions('plan');
    expect(instructions).toContain('critical questions');
    expect(instructions).toContain('save_document');
    expect(instructions).toContain('without automatically updating saved artifacts');
  });

  it('asks every flow-producing mode for the trigger', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const)
      expect(conversationInstructions(mode, { head: 'a', base: 'b' })).toContain('trigger');
  });

  it('kopplar ihop uttryckligen skapade flows i ett dokument', () => {
    const instructions = conversationInstructions('analyse');
    expect(instructions).toContain('one companion document');
    expect(instructions).toContain('links the new flows by name');
    expect(instructions).toContain('Answer discussion and follow-up questions in chat');
  });

  it('ber agenten namnge konversationen med lägets verb', () => {
    expect(conversationInstructions('plan')).toContain('name_conversation');
    expect(conversationInstructions('plan')).toContain('"Plan"');
    expect(conversationInstructions('general')).toContain('name_conversation');
  });

  it('låter alla lägen svara i chatten utan att kräva sparning', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const)
      expect(conversationInstructions(mode, { head: 'a', base: 'b' })).toContain(
        'do not save or update a flow, document or review just because of the conversation mode',
      );
    expect(responseHint()).toContain('answer ordinary questions and discussion in chat');
    expect(responseHint()).not.toContain('one or two sentences');
  });
});
