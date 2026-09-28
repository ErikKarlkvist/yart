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

/** Command to resume an existing agent session on this tab, if there is one. */
export function agentStartCommand(
  agent: Agent,
  guideFile: string,
  codexSessionId: string | null = null,
): string | null {
  switch (agent) {
    case 'claude':
      return `claude --append-system-prompt-file ${guideFile}`;
    case 'codex':
      return isCodexSessionId(codexSessionId) ? `codex resume ${codexSessionId}` : null;
    case 'shell':
      return null;
  }
}

/** Första turen i en ny chatt innehåller både Reverik-guiden och den riktiga frågan. */
export function codexInitialPrompt(
  guideFile: string,
  repoName: string,
  tabId: number,
  request?: string,
): string {
  if (request?.trim()) {
    return `${request.trim()}\n\nBefore responding, read ${guideFile} and follow its instructions.`;
  }
  return `This is the Reverik chat for ${repoName}, tab ${tabId}. Read ${guideFile} and follow its instructions. Reply briefly that you are ready, then wait for my request.`;
}
