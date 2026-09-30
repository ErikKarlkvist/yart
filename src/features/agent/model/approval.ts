import { asRecord } from '@/common/model/json';

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
