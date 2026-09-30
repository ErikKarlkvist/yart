import { useCallback, useState } from 'react';
import { readStored, writeStored } from './storage';

/**
 * Ett val ur en fast lista som ska överleva en omstart. Okända värden faller
 * tillbaka på `initial`. Tål att localStorage saknas.
 */
export function useStoredChoice<T extends string>(
  key: string,
  options: readonly T[],
  initial: T,
): [T, (next: string) => void] {
  const parse = useCallback(
    (value: string | null): T =>
      value !== null && (options as readonly string[]).includes(value) ? (value as T) : initial,
    [options, initial],
  );
  const [value, setValue] = useState<T>(() => parse(readStored(key)));
  const set = useCallback(
    (next: string) => {
      const parsed = parse(next);
      setValue(parsed);
      writeStored(key, parsed);
    },
    [key, parse],
  );
  return [value, set];
}

/**
 * En sträng som ska överleva en omstart, t.ex. en modell agenten själv listat.
 * Värden som inte klarar `isValid` faller tillbaka på `initial`.
 */
export function useStoredString(
  key: string,
  initial: string,
  isValid: (value: string) => boolean,
): [string, (next: string) => void] {
  const [value, setValue] = useState<string>(() => {
    const stored = readStored(key);
    return stored !== null && isValid(stored) ? stored : initial;
  });
  const set = useCallback(
    (next: string) => {
      const checked = isValid(next) ? next : initial;
      setValue(checked);
      writeStored(key, checked);
    },
    [key, initial, isValid],
  );
  return [value, set];
}
