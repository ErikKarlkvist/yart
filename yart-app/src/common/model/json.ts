/**
 * Små hjälpare för okänd data, t.ex. JSON från en agent eller ett kastat fel.
 */

/** Ett vanligt objekt, inte null och inte en lista. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objektet, eller ett tomt objekt för allt annat, så fält kan läsas utan kontroller. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Texten i ett kastat fel, vad som än kastades. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
