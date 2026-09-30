/**
 * Dockorna runt arbetsytan: vänster, höger och nederkant. Varje panel i appen
 * hör till exakt en docka, som en flik eller stängd. En stängd panel minns sin
 * docka och öppnas där igen. Dockan visar en flik i taget och kan fällas ihop. Allt här är rena funktioner över layouten, så renderern bara
 * ritar och sparar.
 */

export const DOCK_SIDES = ['left', 'right', 'bottom'] as const;
export type DockSide = (typeof DOCK_SIDES)[number];

interface DockState {
  /** Panelernas id i flikordning */
  panels: string[];
  /** Stängda paneler som hör till dockan, utan flik */
  closed: string[];
  /** Vald flik, null när dockan är tom */
  active: string | null;
  open: boolean;
  /** Bredd för sidodockorna, höjd för den nedre, i pixlar */
  size: number;
}

export type DockLayoutState = Readonly<Record<DockSide, DockState>>;

/** Gränser för dockornas storlek i pixlar */
export const DOCK_LIMITS: Readonly<Record<DockSide, { min: number; max: number }>> = {
  left: { min: 200, max: 600 },
  right: { min: 280, max: 900 },
  bottom: { min: 120, max: 700 },
};

/** Dockan panelen hör till, även om den är stängd */
export function sideOf(layout: DockLayoutState, id: string): DockSide | null {
  return (
    DOCK_SIDES.find(
      (side) => layout[side].panels.includes(id) || layout[side].closed.includes(id),
    ) ?? null
  );
}

export function isClosed(layout: DockLayoutState, id: string): boolean {
  return DOCK_SIDES.some((side) => layout[side].closed.includes(id));
}

/**
 * Flyttar panelen till `to`, på plats `index` eller sist. Målet öppnas och
 * visar panelen, en stängd panel öppnas. En docka som blir tom fälls ihop.
 */
export function movePanel(
  layout: DockLayoutState,
  id: string,
  to: DockSide,
  index?: number,
): DockLayoutState {
  const from = sideOf(layout, id);
  if (from === null) return layout;
  const without = layout[from].panels.filter((p) => p !== id);
  // Index räknas i målets lista före flytten, så en flytt inom samma docka hamnar rätt.
  const oldIndex = layout[from].panels.indexOf(id);
  const targetList = from === to ? without : layout[to].panels;
  const at =
    index === undefined
      ? targetList.length
      : Math.max(
          0,
          Math.min(targetList.length, from === to && index > oldIndex ? index - 1 : index),
        );
  const panels = [...targetList.slice(0, at), id, ...targetList.slice(at)];

  const next: Record<DockSide, DockState> = { ...layout };
  if (from !== to) {
    const source = layout[from];
    next[from] = {
      ...source,
      panels: without,
      closed: source.closed.filter((p) => p !== id),
      active: source.active === id ? neighbour(source.panels, id) : source.active,
      open: source.open && without.length > 0,
    };
  }
  const target = next[to];
  next[to] = {
    ...target,
    panels,
    closed: target.closed.filter((p) => p !== id),
    active: id,
    open: true,
  };
  return next;
}

/** Öppnar dockan panelen hör till och väljer den. En stängd panel får tillbaka sin flik sist. */
export function revealPanel(layout: DockLayoutState, id: string): DockLayoutState {
  const side = sideOf(layout, id);
  if (side === null) return layout;
  const dock = layout[side];
  if (dock.closed.includes(id)) return movePanel(layout, id, side);
  if (dock.open && dock.active === id) return layout;
  return { ...layout, [side]: { ...dock, active: id, open: true } };
}

/** Stänger panelens flik. Panelen minns dockan, och dockan fälls ihop om den blir tom. */
export function closePanel(layout: DockLayoutState, id: string): DockLayoutState {
  const side = sideOf(layout, id);
  if (side === null) return layout;
  const dock = layout[side];
  if (!dock.panels.includes(id)) return layout;
  const panels = dock.panels.filter((p) => p !== id);
  return {
    ...layout,
    [side]: {
      ...dock,
      panels,
      closed: [...dock.closed, id],
      active: dock.active === id ? neighbour(dock.panels, id) : dock.active,
      open: dock.open && panels.length > 0,
    },
  };
}

/** Väljer panelen i sin docka utan att öppna den. */
export function activatePanel(layout: DockLayoutState, id: string): DockLayoutState {
  const side = sideOf(layout, id);
  if (side === null || layout[side].active === id) return layout;
  return { ...layout, [side]: { ...layout[side], active: id } };
}

export function setDockOpen(
  layout: DockLayoutState,
  side: DockSide,
  open: boolean,
): DockLayoutState {
  if (layout[side].open === open) return layout;
  return { ...layout, [side]: { ...layout[side], open } };
}

export function resizeDock(layout: DockLayoutState, side: DockSide, size: number): DockLayoutState {
  const { min, max } = DOCK_LIMITS[side];
  const clamped = Math.round(Math.max(min, Math.min(max, size)));
  if (layout[side].size === clamped) return layout;
  return { ...layout, [side]: { ...layout[side], size: clamped } };
}

/**
 * Läser en sparad layout mot standardlayouten. Okända och dubblerade paneler
 * tas bort, paneler som saknas (t.ex. nya i en senare version) läggs i sin
 * standarddocka. Trasiga värden faller tillbaka på standard.
 */
export function normalizeLayout(value: unknown, defaults: DockLayoutState): DockLayoutState {
  const known = new Set(
    DOCK_SIDES.flatMap((side) => [...defaults[side].panels, ...defaults[side].closed]),
  );
  const seen = new Set<string>();
  const stored = isRecord(value) ? value : {};

  const next = {} as Record<DockSide, DockState>;
  for (const side of DOCK_SIDES) {
    const raw = stored[side];
    const dock = isRecord(raw) ? raw : {};
    const pick = (list: unknown, fallback: readonly string[]): string[] => {
      const result: string[] = [];
      for (const id of Array.isArray(list) ? (list as unknown[]) : fallback) {
        if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
      }
      return result;
    };
    const panels = pick(dock.panels, defaults[side].panels);
    const closed = pick(dock.closed, defaults[side].closed);
    const size = typeof dock.size === 'number' && dock.size > 0 ? dock.size : defaults[side].size;
    next[side] = {
      panels,
      closed,
      active: typeof dock.active === 'string' ? dock.active : defaults[side].active,
      open: typeof dock.open === 'boolean' ? dock.open : defaults[side].open,
      size: Math.max(DOCK_LIMITS[side].min, Math.min(DOCK_LIMITS[side].max, size)),
    };
  }
  for (const side of DOCK_SIDES) {
    for (const id of defaults[side].panels) if (!seen.has(id)) next[side].panels.push(id);
    for (const id of defaults[side].closed) if (!seen.has(id)) next[side].closed.push(id);
  }
  for (const side of DOCK_SIDES) {
    const dock = next[side];
    if (dock.active === null || !dock.panels.includes(dock.active))
      dock.active = dock.panels[0] ?? null;
  }
  return next;
}

/** Fliken som tar över när `id` lämnar listan: den före, annars den efter. */
function neighbour(panels: readonly string[], id: string): string | null {
  const index = panels.indexOf(id);
  return panels[index - 1] ?? panels[index + 1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
