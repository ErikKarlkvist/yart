/** Indexet är en lucka i fliklistan före flytten, från 0 till listans längd. */
export function reorderTabs(ids: number[], id: number, index: number): number[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const remaining = ids.filter((tab) => tab !== id);
  const at = Math.max(0, Math.min(remaining.length, index > from ? index - 1 : index));
  if (at === from) return ids;
  return [...remaining.slice(0, at), id, ...remaining.slice(at)];
}
