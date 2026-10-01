import { z } from 'zod';

/**
 * Namnet en analys sparas under. Unikt per repo och sort, så att samma namn
 * sparat igen ersätter den tidigare analysen. Filnamn i inkorgen utan `.json`
 * följer samma regel.
 */
export const analysisNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  .describe(
    'Kebab-case name that identifies the analysis in this repository, e.g. "add-todo". Saving the same name again replaces the earlier version.',
  );

/** Namnet ur ett filnamn i inkorgen: `add-todo.json` blir `add-todo`. */
export function nameFromFile(file: string): string {
  const base = file.split(/[\\/]/).pop() ?? file;
  return base.replace(/\.json$/, '');
}
