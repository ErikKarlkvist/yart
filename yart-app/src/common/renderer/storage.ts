import { createContext, useContext } from 'react';

/**
 * Prefix för nycklar som ska vara separata per appflik, t.ex. valt repo.
 * Tomt utanför flikarna. Sätts av AppTabs.
 */
export const StorageScopeContext = createContext('');

/** Nyckeln med aktuell fliks prefix. Globala inställningar använder nyckeln rakt av. */
export function useScopedKey(key: string): string {
  const scope = useContext(StorageScopeContext);
  return scope ? `${scope}${key}` : key;
}

/**
 * Tunna lager över localStorage som tål att lagringen saknas eller är
 * blockerad. Används för sådant som ska överleva en omstart: paneler,
 * senaste repo, vald analys.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ingen lagring, värdet gäller ändå för sessionen
  }
}

export function readStoredJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readStored(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
