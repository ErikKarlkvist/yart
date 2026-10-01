/**
 * Agenterna appen känner till. `claude` och `codex` kan appen köra i
 * bakgrunden; `manual` betyder en extern AI som kopplas via MCP.
 */
export const AGENT_KINDS = ['claude', 'codex', 'manual'] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/** Agenterna appen kan köra själv. */
export type RunnableAgent = Exclude<AgentKind, 'manual'>;

/**
 * Hur mycket agenten får göra utan att fråga. Den har alltid skrivrätt i repot.
 * auto: ändrar filer utan att fråga och frågar bara för annat, som kommandon.
 * manual: frågar innan den ändrar något.
 */
export const AGENT_PERMISSIONS = ['auto', 'manual'] as const;
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

/** Det användaren valt under textrutan och som gäller när agenten startas. */
export interface AgentSettings {
  permission: AgentPermission;
  /** Modellens värde som agenten tar emot, `default` låter agenten välja */
  model: string;
  /** Hur mycket agenten tänker, `default` låter agenten välja */
  effort: string;
}

/** Värdet för "låt agenten välja", för både modell och effort */
export const DEFAULT_CHOICE = 'default';

/** En modell som den installerade agenten själv säger att den har. */
export interface AgentModel {
  value: string;
  label: string;
  description: string;
  /** Effort-nivåerna modellen stöder, tom om den saknar effort */
  effortLevels: string[];
}

/**
 * Ett modell- eller effortvärde som går att skicka som argument. Värdena
 * kommer från agenten själv men lagras i renderern, så de kontrolleras.
 */
export function isSafeChoice(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,79}$/.test(value);
}

/**
 * MCP-verktyget appens Claude Code-session frågar när något kräver lov, så
 * frågan visas i agentpanelen. Finns bara för sessioner appen själv startat.
 */
export const PERMISSION_PROMPT_TOOL = 'permission_prompt';

/**
 * MCP-verktyget appens agent namnger konversationen med, t.ex. "Analysera hur
 * todos läggs till". Finns bara för appens egna sessioner.
 */
export const NAME_CONVERSATION_TOOL = 'name_conversation';

/** Det agenten vill göra och behöver lov för, t.ex. ett kommando eller en filändring. */
export interface ApprovalRequest {
  tool: string;
  input: unknown;
}

export type ApprovalDecision = { allow: true } | { allow: false; message: string };
