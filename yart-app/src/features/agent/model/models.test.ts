import { describe, expect, it } from 'vitest';
import { parseClaudeModels, parseCodexModels } from './models';

describe('parseClaudeModels', () => {
  it('läser modellerna ur svaret på initialize', () => {
    const line = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'yart-models',
        response: {
          models: [
            {
              value: 'default',
              displayName: 'Default (recommended)',
              description: 'Opus 5',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'high'],
            },
            { value: 'haiku', displayName: 'Haiku', description: 'Fastest' },
            { displayName: 'no value' },
          ],
        },
      },
    });
    expect(parseClaudeModels(line)).toEqual([
      {
        value: 'default',
        label: 'Default (recommended)',
        description: 'Opus 5',
        effortLevels: ['low', 'high'],
      },
      { value: 'haiku', label: 'Haiku', description: 'Fastest', effortLevels: [] },
    ]);
  });

  it('ignorerar andra rader', () => {
    expect(parseClaudeModels('{"type":"system"}')).toBeNull();
    expect(parseClaudeModels('inte json')).toBeNull();
  });
});

describe('parseCodexModels', () => {
  it('läser modell-id och effort från app-server och döljer interna modeller', () => {
    expect(
      parseCodexModels({
        result: {
          data: [
            {
              id: 'picker-id',
              model: 'available-model',
              displayName: 'Available',
              description: 'Fast',
              supportedReasoningEfforts: [
                { reasoningEffort: 'low' },
                { reasoningEffort: 'high' },
                {},
              ],
            },
            { model: 'hidden-model', hidden: true },
            { model: '' },
            { displayName: 'no model' },
            { model: 'minimal-model' },
          ],
          nextCursor: 'page-2',
        },
      }),
    ).toEqual({
      models: [
        {
          value: 'available-model',
          label: 'Available',
          description: 'Fast',
          effortLevels: ['low', 'high'],
        },
        { value: 'minimal-model', label: 'minimal-model', description: '', effortLevels: [] },
      ],
      nextCursor: 'page-2',
    });
  });

  it('ignorerar andra svar och känner igen sista sidan', () => {
    expect(parseCodexModels({ result: {} })).toBeNull();
    expect(parseCodexModels({ error: { message: 'failed' } })).toBeNull();
    expect(parseCodexModels({ result: { data: [], nextCursor: null } })).toEqual({
      models: [],
      nextCursor: null,
    });
  });
});
