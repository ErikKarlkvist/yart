/**
 * Appens egna agentsessioner: Claude Code och Codex körs headless med
 * strömmande JSON på stdout. Här ligger det rena: kommandoraderna och
 * tolkningen av raderna processerna skriver.
 */

import {
  type AgentPermission,
  PERMISSION_PROMPT_TOOL,
  type RunnableAgent,
} from '@/common/model/agent';
import { isRecord } from '@/common/model/json';

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
  /** A CLI can exist but fail to run; show that failure instead of saying it is missing. */
  error?: string;
}

/**
 * Verktyg Claude Code får använda utan att fråga i båda lägena: läsa kod, läsa git,
 * leverera till appen och namnge konversationen. Filändringar godkänns av Auto,
 * allt annat frågar via permission_prompt.
 */
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
  'mcp__yart__list_repos',
  'mcp__yart__list_analyses',
  'mcp__yart__get_analysis',
  'mcp__yart__save_flow',
  'mcp__yart__save_document',
  'mcp__yart__save_review',
  'mcp__yart__name_conversation',
];

/**
 * Hur länge Claude Code väntar på ett MCP-verktyg. Godkännanden väntar på
 * användaren, så gränsen är en timme i stället för standardens.
 */
const MCP_TOOL_TIMEOUT_MS = String(60 * 60 * 1000);

interface AgentLaunch {
  command: string;
  args: string[];
  /** Skrivs på stdin direkt efter start, för processer som tar frågan där */
  stdin?: string;
  /** Extra miljövariabler för processen */
  env?: Record<string, string>;
}

/** Det en runner behöver veta för att starta eller fortsätta. */
export interface LaunchInput {
  mcpUrl: string;
  /** Skillen: systemprompt för Claude Code, inledning på första frågan för Codex */
  skill: string;
  prompt: string;
  /** Tråden att fortsätta, null vid första frågan */
  threadId: string | null;
  permission: AgentPermission;
  /** Modellen att köra, `default` låter agenten välja */
  model: string;
  /** Effort-nivån, `default` låter agenten välja */
  effort: string;
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

/** Claude Codes --permission-mode för varje läge. */
const CLAUDE_PERMISSION_MODES: Readonly<Record<AgentPermission, string>> = {
  edits: 'acceptEdits',
  all: 'bypassPermissions',
  manual: 'default',
};

/** Claude Code: en långlivad `claude -p` med stream-json in och ut. */
export const claudeRunner: AgentRunner = {
  kind: 'claude',
  persistent: true,
  launch: ({ mcpUrl, skill, prompt, threadId, permission, model, effort }) => ({
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
      JSON.stringify({ mcpServers: { yart: { type: 'http', url: mcpUrl } } }),
      '--allowedTools',
      ...ALLOWED_TOOLS,
      // Allt som kräver lov i läget går till panelen via permission_prompt.
      '--permission-mode',
      CLAUDE_PERMISSION_MODES[permission],
      '--permission-prompt-tool',
      `mcp__yart__${PERMISSION_PROMPT_TOOL}`,
      ...(model === 'default' ? [] : ['--model', model]),
      ...(effort === 'default' ? [] : ['--effort', effort]),
      '--append-system-prompt',
      skill,
      ...(threadId ? ['--resume', threadId] : []),
    ],
    stdin: claudeMessage(prompt),
    env: { MCP_TOOL_TIMEOUT: MCP_TOOL_TIMEOUT_MS },
  }),
  message: claudeMessage,
  parse: parseClaudeLine,
};

/**
 * Codex: `codex exec --json` per fråga, med skrivrätt i repot och Yarts
 * MCP-server som konfiguration. exec kan inte fråga användaren, så Manual
 * låter Codex automatiska granskare godkänna i stället. Följdfrågor
 * återupptar tråden. Skillen inleder första frågan eftersom exec saknar
 * systemprompt.
 */
export const codexRunner: AgentRunner = {
  kind: 'codex',
  persistent: false,
  launch: ({ mcpUrl, skill, prompt, threadId, permission, model, effort }) => {
    const shared = [
      '--json',
      '--skip-git-repo-check',
      ...(model === 'default' ? [] : ['-m', model]),
      ...(effort === 'default' ? [] : ['-c', `model_reasoning_effort=${JSON.stringify(effort)}`]),
      '-c',
      `approval_policy="${permission === 'manual' ? 'on-request' : 'never'}"`,
      ...(permission === 'manual' ? ['-c', 'approvals_reviewer="auto_review"'] : []),
      '-c',
      `mcp_servers.yart.url=${JSON.stringify(mcpUrl)}`,
      ...(['save_flow', 'save_document', 'save_review', 'name_conversation'] as const).flatMap(
        (tool) => ['-c', `mcp_servers.yart.tools.${tool}.approval_mode="approve"`],
      ),
    ];
    // Allow all släpper sandlådan, så kommandon når även utanför repot och nätet.
    const sandbox = permission === 'all' ? 'danger-full-access' : 'workspace-write';
    const text = threadId === null ? `${skill}\n\n---\n\n${prompt}` : prompt;
    return {
      command: 'codex',
      args:
        threadId === null
          ? ['exec', ...shared, '--sandbox', sandbox, '-']
          : ['exec', 'resume', ...shared, '-c', `sandbox_mode="${sandbox}"`, threadId, '-'],
      stdin: text,
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
    return isRecord(json) ? json : null;
  } catch {
    return null;
  }
}

/** Tolkar en rad stream-json från Claude Code. Okända rader ignoreras. */
export function parseClaudeLine(line: string): AgentOutput[] {
  const record = parseJson(line);
  if (!record) return [];
  if (
    record.type === 'system' &&
    record.subtype === 'init' &&
    typeof record.session_id === 'string'
  )
    return [{ type: 'thread', id: record.session_id }];
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

/** MCP-verktyg visas med sitt korta namn, `mcp__yart__save_flow` blir `save_flow`. */
function toolLabel(name: string): string {
  return name.replace(/^mcp__yart__/, '');
}
