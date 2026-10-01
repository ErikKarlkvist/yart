import { type AgentEntry } from './protocol';

type ToolEntry = Extract<AgentEntry, { kind: 'tool' }>;
type TextEntry = Exclude<AgentEntry, { kind: 'tool' }>;

/** En rad i samtalet: ett meddelande, eller verktygsanrop i följd som en grupp. */
export type EntryGroup =
  | { kind: 'entry'; key: string; entry: TextEntry }
  | { kind: 'tools'; key: string; tools: ToolEntry[] };

/**
 * Slår ihop verktygsanrop som kommer i följd, så samtalet visar en rad per
 * följd i stället för en rad per anrop. Nyckeln bygger på första anropet,
 * så en grupp behåller sitt läge medan den växer.
 */
export function groupEntries(entries: readonly AgentEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  entries.forEach((entry, index) => {
    const key = `${entry.at}:${index}`;
    if (entry.kind !== 'tool') {
      groups.push({ kind: 'entry', key, entry });
      return;
    }
    const last = groups.at(-1);
    if (last?.kind === 'tools') last.tools.push(entry);
    else groups.push({ kind: 'tools', key, tools: [entry] });
  });
  return groups;
}
