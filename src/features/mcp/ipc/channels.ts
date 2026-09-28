import { defineChannel, defineEvent } from '@/common/ipc/channel';
import { type McpActivity, type McpStatus } from '../model/mcp';

/** Var servern lyssnar, hur många agenter som är anslutna och de senaste anropen. */
export const mcpStatusChannel = defineChannel<undefined, McpStatus>('mcp:status');

/** Ett verktygsanrop har gjorts, lyckat eller inte. */
export const mcpActivityEvent = defineEvent<McpActivity>('mcp:activity');
