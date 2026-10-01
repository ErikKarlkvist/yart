import { type AgentModel } from '@/common/model/agent';
import { asRecord } from '@/common/model/json';

/**
 * Claude Code svarar på en initialize-förfrågan i stream-json med bland annat
 * de modeller kontot har, samma lista som /model visar. Ingen fråga går till
 * modellen, så det kostar inget.
 */
export const CLAUDE_INITIALIZE = `${JSON.stringify({
  type: 'control_request',
  request_id: 'yart-models',
  request: { subtype: 'initialize' },
})}\n`;

/** Modellerna ur svaret på initialize, eller null om raden är något annat. */
export function parseClaudeModels(line: string): AgentModel[] | null {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return null;
  }
  const response = asRecord(asRecord(asRecord(message).response).response);
  if (asRecord(message).type !== 'control_response' || !Array.isArray(response.models)) return null;
  return response.models.flatMap((raw: unknown): AgentModel[] => {
    const item = asRecord(raw);
    if (typeof item.value !== 'string' || item.value === '') return [];
    const levels = Array.isArray(item.supportedEffortLevels)
      ? item.supportedEffortLevels.filter((level): level is string => typeof level === 'string')
      : [];
    return [
      {
        value: item.value,
        label: typeof item.displayName === 'string' ? item.displayName : item.value,
        description: typeof item.description === 'string' ? item.description : '',
        effortLevels: item.supportsEffort === true ? levels : [],
      },
    ];
  });
}

export interface CodexModelPage {
  models: AgentModel[];
  nextCursor: string | null;
}

/** Modellerna och nästa sida ur Codex app-servers model/list-svar. */
export function parseCodexModels(message: unknown): CodexModelPage | null {
  const result = asRecord(asRecord(message).result);
  if (!Array.isArray(result.data)) return null;
  return {
    models: result.data.flatMap((raw: unknown): AgentModel[] => {
      const item = asRecord(raw);
      if (typeof item.model !== 'string' || item.model === '' || item.hidden === true) return [];
      const levels = Array.isArray(item.supportedReasoningEfforts)
        ? item.supportedReasoningEfforts.flatMap((rawLevel: unknown): string[] => {
            const level = asRecord(rawLevel).reasoningEffort;
            return typeof level === 'string' ? [level] : [];
          })
        : [];
      return [
        {
          value: item.model,
          label: typeof item.displayName === 'string' ? item.displayName : item.model,
          description: typeof item.description === 'string' ? item.description : '',
          effortLevels: levels,
        },
      ];
    }),
    nextCursor: typeof result.nextCursor === 'string' ? result.nextCursor : null,
  };
}
