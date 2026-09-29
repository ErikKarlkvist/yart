import { type AgentKind, type RunnableAgent } from '@/common/model/agent';

/** Agenter som läser skills i formatet SKILL.md ur en egen mapp. */
export type SkillTarget = RunnableAgent;

/** Var respektive agent letar efter personliga skills, relativt hemmappen. */
export const SKILL_PATHS: Readonly<Record<SkillTarget, string>> = {
  claude: '.claude/skills/reverik/SKILL.md',
  codex: '.codex/skills/reverik/SKILL.md',
};

/** Kommandot som registrerar servern hos agenten. null för agenter utan känt kommando. */
export function connectCommand(agent: AgentKind, url: string): string | null {
  switch (agent) {
    case 'claude':
      return `claude mcp add --transport http reverik ${url}`;
    case 'codex':
      return `codex mcp add reverik --url ${url}`;
    case 'manual':
      return null;
  }
}

/** Samma registrering som konfiguration, för den som hellre redigerar filen. */
export function codexConfigSnippet(url: string): string {
  return `[mcp_servers.reverik]\nurl = "${url}"`;
}
