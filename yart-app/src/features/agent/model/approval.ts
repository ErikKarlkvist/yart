import { asRecord } from '@/common/model/json';

/** Claude Codes verktyg för frågor till användaren. Det kräver svar, inte bara lov. */
export const ASK_QUESTION_TOOL = 'AskUserQuestion';

export interface AgentQuestion {
  question: string;
  /** Kort etikett, t.ex. "Scope" */
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

/**
 * En rad som säger vad agenten vill göra, för godkännandet i panelen:
 * kommandot för Bash, filen för en ändring, annars verktygets indata kort.
 */
export function describeApproval(input: unknown): string {
  const record = asRecord(input);
  const text = (key: string): string | null => {
    const value = record[key];
    return typeof value === 'string' ? value : null;
  };
  const detail =
    text('command') ?? text('file_path') ?? text('notebook_path') ?? text('url') ?? text('pattern');
  if (detail !== null) return detail;
  const json = input === undefined ? '' : JSON.stringify(input);
  return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

/** Frågorna i ett AskUserQuestion-anrop, eller null om indata inte ser ut så. */
export function parseQuestions(input: unknown): AgentQuestion[] | null {
  const list = asRecord(input).questions;
  if (!Array.isArray(list)) return null;
  const questions = list.flatMap((raw): AgentQuestion[] => {
    const item = asRecord(raw);
    if (typeof item.question !== 'string') return [];
    const options = Array.isArray(item.options)
      ? item.options.flatMap((option) => {
          const record = asRecord(option);
          return typeof record.label === 'string'
            ? [
                {
                  label: record.label,
                  description: typeof record.description === 'string' ? record.description : '',
                },
              ]
            : [];
        })
      : [];
    return [
      {
        question: item.question,
        header: typeof item.header === 'string' ? item.header : '',
        options,
        multiSelect: item.multiSelect === true,
      },
    ];
  });
  return questions.length > 0 ? questions : null;
}

/**
 * Indata tillbaka till AskUserQuestion: frågorna som de var och svaren per
 * frågetext. Flera val skrivs kommaseparerade, som Claude Code väntar sig.
 */
export function answeredInput(
  input: unknown,
  answers: Readonly<Record<string, string>>,
): Record<string, unknown> {
  return { ...asRecord(input), answers: { ...answers } };
}
