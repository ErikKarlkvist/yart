import { describe, expect, it } from 'vitest';
import {
  conversationInstructions,
  deliveryReminder,
  isDeliveryTool,
} from './conversationInstructions';

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

  it('ber agenten namnge konversationen med lägets verb', () => {
    expect(conversationInstructions('plan')).toContain('name_conversation');
    expect(conversationInstructions('plan')).toContain('"Plan"');
    expect(conversationInstructions('general')).toContain('name_conversation');
  });

  it('säger att svaret ska sparas i Reverik och inte skrivas i chatten', () => {
    for (const mode of ['analyse', 'review', 'plan'] as const)
      expect(conversationInstructions(mode, { head: 'a', base: 'b' })).toContain(
        'Deliver the answer in Reverik, not in the chat',
      );
    expect(conversationInstructions('general')).not.toContain('Deliver the answer in Reverik');
  });
});

describe('deliveryReminder', () => {
  it('påminner i lägen som levererar, inte i Chat', () => {
    expect(deliveryReminder('analyse')).toContain('save_flow');
    expect(deliveryReminder('general')).toBeNull();
  });

  it('känner igen sparverktygen med och utan prefix', () => {
    expect(isDeliveryTool('save_flow')).toBe(true);
    expect(isDeliveryTool('reverik.save_review')).toBe(true);
    expect(isDeliveryTool('list_analyses')).toBe(false);
    expect(isDeliveryTool('name_conversation')).toBe(false);
  });
});
