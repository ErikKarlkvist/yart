/**
 * Filtrerar en lista på en sökfras, skiftlägesokänsligt. Prefixträffar
 * först, sedan träffar på segmentstart (efter / - _ .), sedan övriga.
 */
export function filterOptions(options: readonly string[], query: string, limit = 50): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  const rank = (option: string): number => {
    const lower = option.toLowerCase();
    if (lower.startsWith(q)) return 0;
    if (lower.split(/[/\-_.]/).some((segment) => segment.startsWith(q))) return 1;
    return lower.includes(q) ? 2 : -1;
  };
  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.option.localeCompare(b.option))
    .slice(0, limit)
    .map((x) => x.option);
}
