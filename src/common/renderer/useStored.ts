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
