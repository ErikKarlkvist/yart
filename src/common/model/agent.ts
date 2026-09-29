/**
 * Agenterna appen känner till. `claude` och `codex` kan appen köra i
 * bakgrunden; `manual` betyder en extern AI som kopplas via MCP.
 */
export const AGENT_KINDS = ['claude', 'codex', 'manual'] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/** Agenterna appen kan köra själv. */
export type RunnableAgent = Exclude<AgentKind, 'manual'>;
