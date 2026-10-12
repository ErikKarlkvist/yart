/**
 * Det användaren gjort med listan över analyser: ordningen på grupperna och
 * analyserna i dem, egna rubriker och analyser som flyttats till en annan
 * grupp. Grupperna själva härleds av listan; det här lagras bara som
 * nycklar och id, så det som inte längre finns ignoreras tyst.
 */
export interface ListLayout {
  /** Gruppnycklar i användarens ordning. Okända grupper hamnar efter, i sin egen ordning. */
  groups: string[];
  /** Egna rubriker per gruppnyckel */
  labels: Record<string, string>;
  /** Analys-id per gruppnyckel i användarens ordning. Id som saknas hamnar sist. */
  items: Record<string, string[]>;
  /** Gruppnyckel per analys-id som flyttats dit från sin egen grupp */
  moved: Record<string, string>;
}

export const EMPTY_LAYOUT: ListLayout = { groups: [], labels: {}, items: {}, moved: {} };

export function isListLayout(value: unknown): value is ListLayout {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.groups) &&
    v.groups.every((g) => typeof g === 'string') &&
    isStringRecord(v.labels) &&
    isStringRecord(v.moved) &&
    typeof v.items === 'object' &&
    v.items !== null &&
    Object.values(v.items).every((list) => Array.isArray(list))
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

/** Det listan behöver av en grupp och ett objekt för att ordnas. */
export interface Orderable<G extends { key: string; label: string }, I extends { id: string }> {
  groups: G[];
  itemsOf: (group: G) => I[];
  withItems: (group: G, items: I[], label: string) => G;
}

/**
 * Lägger användarens ordning, rubriker och flyttar på de härledda grupperna.
 * Flyttade analyser tas ur sin grupp och läggs i målgruppen; finns inte
 * målgruppen längre stannar de där de är.
 */
export function applyLayout<G extends { key: string; label: string }, I extends { id: string }>(
  layout: ListLayout,
  { groups, itemsOf, withItems }: Orderable<G, I>,
): G[] {
  const keys = new Set(groups.map((g) => g.key));
  const moved = new Map<string, I[]>();
  const kept = new Map<string, I[]>();
  for (const group of groups) {
    for (const item of itemsOf(group)) {
      const target = layout.moved[item.id];
      const to = target !== undefined && keys.has(target) && target !== group.key ? target : null;
      const bucket = to === null ? kept : moved;
      const list = bucket.get(to ?? group.key) ?? [];
      list.push(item);
      bucket.set(to ?? group.key, list);
    }
  }
  const ordered = groups.map((group) => {
    const items = [...(kept.get(group.key) ?? []), ...(moved.get(group.key) ?? [])];
    return withItems(
      group,
      sortByIds(items, layout.items[group.key] ?? []),
      layout.labels[group.key] ?? group.label,
    );
  });
  return sortByKeys(ordered, layout.groups);
}

/** Objekten i den sparade ordningen; de som inte nämns behåller sin ordning efter de nämnda. */
function sortByIds<I extends { id: string }>(items: I[], ids: readonly string[]): I[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort(
    (a, b) =>
      (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
      items.indexOf(a) - items.indexOf(b),
  );
}

function sortByKeys<G extends { key: string }>(groups: G[], keys: readonly string[]): G[] {
  const rank = new Map(keys.map((key, i) => [key, i]));
  return [...groups].sort(
    (a, b) =>
      (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity) ||
      groups.indexOf(a) - groups.indexOf(b),
  );
}

/** Flyttar en grupp till luckan `index` i den visade ordningen `visible`. */
export function moveGroup(
  layout: ListLayout,
  visible: readonly string[],
  key: string,
  index: number,
): ListLayout {
  return { ...layout, groups: insertAt(visible, key, index) };
}

/**
 * Flyttar en analys till luckan `index` i gruppen `to`, vars visade ordning
 * är `visible`. Kommer den från en annan grupp noteras flytten, så den stannar
 * där nästa gång listan byggs. `home` är gruppen analysen härleds till.
 */
export function moveItem(
  layout: ListLayout,
  id: string,
  home: string,
  to: string,
  visible: readonly string[],
  index: number,
): ListLayout {
  const { [id]: _previous, ...moved } = layout.moved;
  const items = Object.fromEntries(
    Object.entries(layout.items).map(([key, ids]) => [key, ids.filter((item) => item !== id)]),
  );
  items[to] = insertAt(visible, id, index);
  return { ...layout, items, moved: to === home ? moved : { ...moved, [id]: to } };
}

export function renameGroup(layout: ListLayout, key: string, label: string): ListLayout {
  const { [key]: _previous, ...labels } = layout.labels;
  const trimmed = label.trim();
  return { ...layout, labels: trimmed ? { ...labels, [key]: trimmed } : labels };
}

/** Indexet är en lucka i listan före flytten, från 0 till listans längd. */
function insertAt(list: readonly string[], id: string, index: number): string[] {
  const from = list.indexOf(id);
  const remaining = list.filter((item) => item !== id);
  const at = Math.max(0, Math.min(remaining.length, from >= 0 && index > from ? index - 1 : index));
  return [...remaining.slice(0, at), id, ...remaining.slice(at)];
}
