/**
 * Föreslår vilken branch man jämför mot: en tidigare vald om den finns kvar,
 * annars main eller master, annars första andra branchen än `head`.
 */
export function defaultBaseBranch(
  branches: readonly string[],
  head: string | null,
  stored: string | null,
): string | null {
  const others = branches.filter((b) => b !== head);
  if (stored && others.includes(stored)) return stored;
  return others.find((b) => b === 'main' || b === 'master') ?? others[0] ?? null;
}

/** Branchen reviewen tittar på: en tidigare vald om den finns kvar, annars den utcheckade. */
export function defaultHeadBranch(
  branches: readonly string[],
  current: string | null,
  stored: string | null,
): string | null {
  if (stored && branches.includes(stored)) return stored;
  return current ?? branches[0] ?? null;
}
