/**
 * Appens egen agentsession: Claude Code körs headless med `claude -p` och
 * strömmande JSON på stdin och stdout. Här ligger det rena: argumenten
 * processen startas med och tolkningen av raderna den skriver.
 */

/** Vilken sorts agent sessionen kör. Bara Claude Code går headless i dag. */
export type AgentKind = 'claude' | 'codex' | 'manual';

export type AgentState =
  /** Ingen process, eller processen väntar på nästa fråga */
  | 'idle'
  | 'busy'
  /** Processen avslutades, nästa fråga startar om den */
  | 'stopped'
  /** Processen kunde inte startas */
  | 'failed';

/** En rad i samtalspanelen. */
export type AgentEntry = { at: string } & (
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  /** Ett verktyg agenten använder, t.ex. save_flow */
  | { kind: 'tool'; name: string }
  | { kind: 'error'; text: string }
);

/** Verktyg agenten får använda utan att fråga: läsa kod, läsa git och leverera till Reverik. */
const ALLOWED_TOOLS: readonly string[] = [
  'Read',
  'Glob',
  'Grep',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git status:*)',
  'Bash(git branch:*)',
  'Bash(git rev-parse:*)',
  'mcp__reverik__list_repos',
  'mcp__reverik__list_analyses',
  'mcp__reverik__get_analysis',
  'mcp__reverik__save_flow',
  'mcp__reverik__save_document',
  'mcp__reverik__save_review',
];

/** Om Claude Code går att köra i bakgrunden: finns den, och är den inloggad? */
export interface AgentCheck {
  installed: boolean;
  version: string | null;
  loggedIn: boolean;
}

export interface AgentLaunch {
  command: string;
  args: string[];
}

/** Kommandoraden för en headless Claude Code-session kopplad till Reveriks MCP-server. */
export function claudeLaunch(mcpUrl: string, systemPrompt: string): AgentLaunch {
  const mcpConfig = JSON.stringify({
    mcpServers: { reverik: { type: 'http', url: mcpUrl } },
  });
  return {
    command: 'claude',
    args: [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--strict-mcp-config',
      '--mcp-config',
      mcpConfig,
      '--allowedTools',
      ...ALLOWED_TOOLS,
      '--append-system-prompt',
      systemPrompt,
    ],
  };
}

/** Raden som skickar en användarfråga till processen. */
export function userMessageLine(text: string): string {
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`;
}

/** Det som en rad från processen betyder för panelen. */
export type AgentOutput =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  /** Svaret på frågan är klart, med fel om agenten inte kom i mål */
  | { type: 'done'; error: string | null }
  | { type: 'ignore' };

interface ContentBlock {
  type?: unknown;
  text?: unknown;
  name?: unknown;
}

/** Tolkar en rad stream-json från Claude Code. Okända rader ignoreras. */
export function parseAgentLine(line: string): AgentOutput[] {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return [];
  }
  if (typeof json !== 'object' || json === null) return [];
  const record = json as Record<string, unknown>;
  if (record.type === 'assistant') {
    const message = record.message as { content?: unknown } | undefined;
    const blocks = Array.isArray(message?.content) ? (message.content as ContentBlock[]) : [];
    return blocks.flatMap((block): AgentOutput[] => {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim())
        return [{ type: 'text', text: block.text }];
      if (block.type === 'tool_use' && typeof block.name === 'string')
        return [{ type: 'tool', name: toolLabel(block.name) }];
      return [];
    });
  }
  if (record.type === 'result') {
    const failed = record.is_error === true || record.subtype !== 'success';
    const text =
      typeof record.result === 'string'
        ? record.result
        : typeof record.subtype === 'string'
          ? record.subtype
          : '';
    return [{ type: 'done', error: failed ? text : null }];
  }
  return [];
}

/** MCP-verktyg visas med sitt korta namn, `mcp__reverik__save_flow` blir `save_flow`. */
function toolLabel(name: string): string {
  return name.replace(/^mcp__reverik__/, '');
}
