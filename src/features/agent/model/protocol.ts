/**
 * Appens egna agentsessioner: Claude Code och Codex körs headless med
 * strömmande JSON på stdout. Här ligger det rena: kommandoraderna och
 * tolkningen av raderna processerna skriver.
 */

import { type RunnableAgent } from '@/common/model/agent';

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

/** Om agenten går att köra i bakgrunden: finns den, och är den inloggad? */
export interface AgentCheck {
  installed: boolean;
  version: string | null;
  loggedIn: boolean;
}

/** Verktyg Claude Code får använda utan att fråga: läsa kod, läsa git och leverera till Reverik. */
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

interface AgentLaunch {
  command: string;
  args: string[];
  /** Skrivs på stdin direkt efter start, för processer som tar frågan där */
  stdin?: string;
}

/** Det en runner behöver veta för att starta eller fortsätta. */
export interface LaunchInput {
  mcpUrl: string;
  /** Skillen: systemprompt för Claude Code, inledning på första frågan för Codex */
  skill: string;
  prompt: string;
  /** Tråden att fortsätta, null vid första frågan */
  threadId: string | null;
}

/** Det som en rad från processen betyder för panelen. */
export type AgentOutput =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  /** Tråden processen skapade, så nästa fråga kan fortsätta den */
  | { type: 'thread'; id: string }
  /** Svaret på frågan är klart, med fel om agenten inte kom i mål */
  | { type: 'done'; error: string | null };

/**
 * Hur en agent körs. En persistent runner håller en process som tar fler
 * frågor på stdin. Annars startas en process per fråga som fortsätter
 * tråden från förra gången.
 */
export interface AgentRunner {
  kind: RunnableAgent;
  persistent: boolean;
  launch: (input: LaunchInput) => AgentLaunch;
  /** Raden som skickar en fråga till en redan startad persistent process */
  message: (prompt: string) => string;
  parse: (line: string) => AgentOutput[];
}

/** Claude Code: en långlivad `claude -p` med stream-json in och ut. */
export const claudeRunner: AgentRunner = {
  kind: 'claude',
  persistent: true,
  launch: ({ mcpUrl, skill, prompt }) => ({
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
      JSON.stringify({ mcpServers: { reverik: { type: 'http', url: mcpUrl } } }),
      '--allowedTools',
      ...ALLOWED_TOOLS,
      '--append-system-prompt',
      skill,
    ],
    stdin: claudeMessage(prompt),
  }),
  message: claudeMessage,
  parse: parseClaudeLine,
};

/**
 * Codex: `codex exec --json` per fråga, i skrivskyddad sandlåda utan
 * godkännanden, med Reveriks MCP-server som konfiguration. Följdfrågor
 * återupptar tråden. Skillen inleder första frågan eftersom exec saknar
 * systemprompt.
 */
export const codexRunner: AgentRunner = {
  kind: 'codex',
  persistent: false,
  launch: ({ mcpUrl, skill, prompt, threadId }) => {
    const shared = [
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '-c',
      `mcp_servers.reverik.url=${JSON.stringify(mcpUrl)}`,
    ];
    const text = threadId === null ? `${skill}\n\n---\n\n${prompt}` : prompt;
    return {
      command: 'codex',
      args:
        threadId === null
          ? ['exec', ...shared, text]
          : ['exec', 'resume', ...shared, threadId, text],
    };
  },
  message: (prompt) => `${prompt}\n`,
  parse: parseCodexLine,
};

export const RUNNERS: Readonly<Record<RunnableAgent, AgentRunner>> = {
  claude: claudeRunner,
  codex: codexRunner,
};

function claudeMessage(text: string): string {
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`;
}

interface ContentBlock {
  type?: unknown;
  text?: unknown;
  name?: unknown;
}

function parseJson(line: string): Record<string, unknown> | null {
  try {
    const json: unknown = JSON.parse(line);
    return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Tolkar en rad stream-json från Claude Code. Okända rader ignoreras. */
export function parseClaudeLine(line: string): AgentOutput[] {
  const record = parseJson(line);
  if (!record) return [];
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

/** Tolkar en rad JSONL från `codex exec --json`. Okända rader ignoreras. */
export function parseCodexLine(line: string): AgentOutput[] {
  const record = parseJson(line);
  if (!record) return [];
  switch (record.type) {
    case 'thread.started':
      return typeof record.thread_id === 'string' ? [{ type: 'thread', id: record.thread_id }] : [];
    case 'item.completed': {
      const item = record.item as { type?: unknown; text?: unknown } | undefined;
      if (item?.type === 'agent_message' && typeof item.text === 'string' && item.text.trim())
        return [{ type: 'text', text: item.text }];
      return [];
    }
    case 'item.started': {
      const item = record.item as { type?: unknown; tool?: unknown; name?: unknown } | undefined;
      if (item?.type === 'mcp_tool_call') {
        const name =
          typeof item.tool === 'string'
            ? item.tool
            : typeof item.name === 'string'
              ? item.name
              : 'tool';
        return [{ type: 'tool', name: toolLabel(name) }];
      }
      return [];
    }
    case 'turn.completed':
      return [{ type: 'done', error: null }];
    case 'turn.failed':
    case 'error': {
      const error = record.error as { message?: unknown } | undefined;
      const text =
        typeof record.message === 'string'
          ? record.message
          : typeof error?.message === 'string'
            ? error.message
            : record.type;
      return [{ type: 'done', error: text }];
    }
    default:
      return [];
  }
}

/** MCP-verktyg visas med sitt korta namn, `mcp__reverik__save_flow` blir `save_flow`. */
function toolLabel(name: string): string {
  return name.replace(/^mcp__reverik__/, '');
}
