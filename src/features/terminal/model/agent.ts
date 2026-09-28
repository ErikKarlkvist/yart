/**
 * Vilken agent som startas i terminalen. `shell` startar ingenting, då får
 * användaren själv köra sin agent och be den läsa guiden.
 */
export const AGENTS = ['claude', 'codex', 'shell'] as const;
export type Agent = (typeof AGENTS)[number];
const CODEX_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCodexSessionId(value: unknown): value is string {
  return typeof value === 'string' && CODEX_SESSION_ID.test(value);
}

/**
 * Kommandot som skrivs in i skalet när terminalen öppnas. Claude Code får
 * guiden som tillägg till systemprompten. Codex återupptar bara sessionen som
 * hör till fliken, annars startar den en ny. null betyder bara ett skal.
 */
export function agentStartCommand(
  agent: Agent,
  guideFile: string,
  codexSessionId: string | null = null,
): string | null {
  switch (agent) {
    case 'claude':
      return `claude --append-system-prompt-file ${guideFile}`;
    case 'codex':
      return isCodexSessionId(codexSessionId)
        ? `codex resume ${codexSessionId} "Read ${guideFile} now and follow it for the rest of this session."`
        : `codex "Read ${guideFile} now and follow it for the rest of this session."`;
    case 'shell':
      return null;
  }
}
