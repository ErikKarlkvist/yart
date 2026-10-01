import { type LanguageStat } from './repo';

const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  vue: 'Vue',
  svelte: 'Svelte',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  cs: 'C#',
  fs: 'F#',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  m: 'Objective-C',
  c: 'C',
  h: 'C',
  cc: 'C++',
  cpp: 'C++',
  hpp: 'C++',
  scala: 'Scala',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  hs: 'Haskell',
  clj: 'Clojure',
  dart: 'Dart',
  lua: 'Lua',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  proto: 'Protobuf',
  html: 'HTML',
  css: 'CSS',
  scss: 'CSS',
  less: 'CSS',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  toml: 'TOML',
  md: 'Markdown',
  mdx: 'Markdown',
  tf: 'Terraform',
};

const MAX_LANGUAGES = 5;

/** Räknar filer per språk utifrån filändelse och returnerar de vanligaste, störst först. */
export function summarizeLanguages(paths: Iterable<string>, limit = MAX_LANGUAGES): LanguageStat[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const language = languageOf(path);
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, files]) => ({ name, files }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function languageOf(path: string): string | null {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  return EXTENSION_TO_LANGUAGE[base.slice(dot + 1).toLowerCase()] ?? null;
}
