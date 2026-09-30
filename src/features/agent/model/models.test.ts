import { describe, expect, it } from 'vitest';
import { parseClaudeModels } from './models';

describe('parseClaudeModels', () => {
  it('läser modellerna ur svaret på initialize', () => {
    const line = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'reverik-models',
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
