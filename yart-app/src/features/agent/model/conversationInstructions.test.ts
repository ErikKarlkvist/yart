import { describe, expect, it } from 'vitest';
import { conversationInstructions, responseHint } from './conversationInstructions';

describe('conversation instructions', () => {
  it('keeps review branches and required outputs in the background context', () => {
    const instructions = conversationInstructions('review', { head: 'feature/a', base: 'main' });
    expect(instructions).toContain('feature/a');
    expect(instructions).toContain('main');
    expect(instructions).toContain('save_review');
  });

  it('lets planning conversations save a plan and ask when requirements are unclear', () => {
    const instructions = conversationInstructions('plan');
    expect(instructions).toContain('critical questions');
    expect(instructions).toContain('save_document');
    expect(instructions).toContain('ask a few focused questions first');
  });

  it('asks every flow-producing mode for the trigger', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const)
      expect(conversationInstructions(mode, { head: 'a', base: 'b' })).toContain('trigger');
  });

  it('kopplar ihop uttryckligen skapade flows i ett dokument', () => {
    const instructions = conversationInstructions('analyse');
    expect(instructions).toContain('one companion document');
    expect(instructions).toContain('links the new flows by name');
    expect(instructions).toContain('A new analysis is delivered as flows');
  });

  it('ber agenten namnge konversationen med lägets verb', () => {
    expect(conversationInstructions('plan')).toContain('name_conversation');
    expect(conversationInstructions('plan')).toContain('"Plan"');
    expect(conversationInstructions('general')).toContain('name_conversation');
  });

  it('levererar nya analyser och avgör sparning per följdfråga', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const) {
      const instructions = conversationInstructions(mode, { head: 'a', base: 'b' });
      expect(instructions).toContain('The first request of a conversation starts a new analysis');
      expect(instructions).toContain('do not ask whether to save');
      expect(instructions).toContain('Do not merge or skip calls');
    }
    expect(responseHint(true)).toContain('starts the conversation');
    expect(responseHint(false)).toContain('follow-up');
    expect(responseHint(false)).toContain('Answer every part of the request');
  });
});
