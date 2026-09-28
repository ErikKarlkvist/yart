/**
 * MCP-servern är vägen in för agenter som körs utanför appen: Claude Code,
 * Codex eller vad som helst som talar MCP över streamable HTTP. Den lyssnar
 * bara på loopback.
 */
export const MCP_HOST = '127.0.0.1';
export const MCP_PATH = '/mcp';
export const DEFAULT_MCP_PORT = 7390;
/** Hur många portar uppåt som prövas om standardporten är upptagen */
const MCP_PORT_ATTEMPTS = 10;
/** Hur många anrop som sparas i aktivitetsloggen */
export const MCP_ACTIVITY_LIMIT = 50;

/** Ett verktygsanrop från en agent, som det visas i appen. */
export interface McpActivity {
  at: string;
  tool: string;
  /** Klientens namn ur MCP-handskakningen, t.ex. claude-code */
  client: string;
  repoPath: string | null;
  ok: boolean;
  summary: string;
}

/** Om skillen för Claude Code finns i användarens skillmapp och är aktuell. */
export type SkillState = 'missing' | 'outdated' | 'current';

export interface McpStatus {
  /** null tills servern lyssnar, eller om den inte kunde starta */
  url: string | null;
  sessions: number;
  activity: McpActivity[];
  error: string | null;
  skill: { path: string; state: SkillState };
}

/** Var Claude Code letar efter personliga skills, relativt hemmappen. */
export const SKILL_RELATIVE_PATH = '.claude/skills/reverik/SKILL.md';

export function mcpUrl(port: number): string {
  return `http://${MCP_HOST}:${port}${MCP_PATH}`;
}

/** Kommandot som registrerar servern i Claude Code. */
export function claudeMcpAddCommand(url: string): string {
  return `claude mcp add --transport http reverik ${url}`;
}

/** Portarna att pröva i ordning. Miljövariabeln låser till en enda. */
export function candidatePorts(env: string | undefined): number[] {
  const fixed = env ? Number.parseInt(env, 10) : Number.NaN;
  if (Number.isInteger(fixed) && fixed > 0) return [fixed];
  return Array.from({ length: MCP_PORT_ATTEMPTS }, (_, i) => DEFAULT_MCP_PORT + i);
}
