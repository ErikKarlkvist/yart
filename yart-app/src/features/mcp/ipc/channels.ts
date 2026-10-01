import { defineChannel, defineEvent } from '@/common/ipc/channel';
import { type SkillTarget } from '../model/agents';
import { type McpActivity, type McpStatus } from '../model/mcp';

/** Var servern lyssnar, hur många agenter som är anslutna och de senaste anropen. */
export const mcpStatusChannel = defineChannel<undefined, McpStatus>('mcp:status');

/** Skriver skillen till agentens skillmapp och svarar med ny status. */
export const installSkillChannel = defineChannel<{ target: SkillTarget }, McpStatus>(
  'mcp:install-skill',
);

/** Skillen som text, för agenter utan skillmapp. */
export const skillTextChannel = defineChannel<undefined, string>('mcp:skill-text');

/** Ett verktygsanrop har gjorts, lyckat eller inte. */
export const mcpActivityEvent = defineEvent<McpActivity>('mcp:activity');
