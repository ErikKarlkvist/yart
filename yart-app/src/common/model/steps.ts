import { type FlowAlt, type FlowStep, type FlowStepEntry, isAlt } from './flow';

/**
 * Vilken gren som spelas i varje alternativ, per nyckel från `altKey`.
 * Ett alternativ som saknas spelar sin första gren.
 */
export type AltChoices = ReadonlyMap<string, number>;

/**
 * Nyckeln för ett alternativ: dess plats i stegträdet. Ett alternativ direkt i
 * flödet heter som sitt index, ett i en gren får förälderns nyckel och grenen
 * före sitt index: "3", "3.1.0".
 */
export function altKey(parent: { key: string; branch: number } | null, index: number): string {
  return parent ? `${parent.key}.${parent.branch}.${index}` : String(index);
}

/** Stegen som spelas med de valda grenarna, i ordning. Samma objekt som i flödet. */
export function resolveSteps(
  entries: readonly FlowStepEntry[],
  choices: AltChoices = new Map(),
): FlowStep[] {
  const result: FlowStep[] = [];
  walkPlayed(entries, choices, null, (step) => result.push(step));
  return result;
}

/** Alla steg i alla grenar, i den ordning de står. */
export function allSteps(entries: readonly FlowStepEntry[]): FlowStep[] {
  return entries.flatMap((entry) =>
    isAlt(entry) ? entry.branches.flatMap((branch) => allSteps(branch.steps)) : [entry],
  );
}

export interface PlayedAlt {
  key: string;
  alt: FlowAlt;
  /** Grenen som spelas */
  selected: number;
}

/** Alternativen uppspelningen passerar med de valda grenarna; de i ovalda grenar hoppas över. */
export function playedAlts(entries: readonly FlowStepEntry[], choices: AltChoices): PlayedAlt[] {
  const result: PlayedAlt[] = [];
  walkPlayed(entries, choices, null, undefined, (key, alt, selected) =>
    result.push({ key, alt, selected }),
  );
  return result;
}

/** Den valda grenen i ett alternativ, inom grenarnas antal. */
export function selectedBranch(alt: FlowAlt, key: string, choices: AltChoices): number {
  const chosen = choices.get(key) ?? 0;
  return chosen >= 0 && chosen < alt.branches.length ? chosen : 0;
}

/**
 * Valen som behövs för att uppspelningen ska passera steget: varje alternativ
 * på vägen dit med grenen steget ligger i. Null om steget inte finns i flödet.
 */
export function choicesFor(
  entries: readonly FlowStepEntry[],
  step: FlowStep,
  parent: { key: string; branch: number } | null = null,
): Map<string, number> | null {
  for (const [index, entry] of entries.entries()) {
    if (entry === step) return new Map();
    if (!isAlt(entry)) continue;
    const key = altKey(parent, index);
    for (const [branch, { steps }] of entry.branches.entries()) {
      const found = choicesFor(steps, step, { key, branch });
      if (found) return new Map([[key, branch], ...found]);
    }
  }
  return null;
}

function walkPlayed(
  entries: readonly FlowStepEntry[],
  choices: AltChoices,
  parent: { key: string; branch: number } | null,
  onStep?: (step: FlowStep) => void,
  onAlt?: (key: string, alt: FlowAlt, selected: number) => void,
): void {
  entries.forEach((entry, index) => {
    if (!isAlt(entry)) {
      onStep?.(entry);
      return;
    }
    const key = altKey(parent, index);
    const selected = selectedBranch(entry, key, choices);
    onAlt?.(key, entry, selected);
    const branch = entry.branches[selected];
    if (branch) walkPlayed(branch.steps, choices, { key, branch: selected }, onStep, onAlt);
  });
}

/**
 * Valen som gör att uppspelningen går in i grenen `branch` av alternativet
 * `key`: grenen själv och grenen i varje alternativ utanför, ur nyckeln.
 */
export function choicesForBranch(key: string, branch: number): Map<string, number> {
  const parts = key.split('.');
  const result = new Map<string, number>();
  for (let i = 1; i < parts.length; i += 2) {
    result.set(parts.slice(0, i).join('.'), Number(parts[i]));
  }
  result.set(key, branch);
  return result;
}
