import { app } from 'electron';
import { appInfoChannel } from '@/application/ipc/channels';
import { handleChannel } from '@/common/main/ipc';
import { registerAgentHandlers } from '@/features/agent/main';
import { registerAnalysisHandlers } from '@/features/analysis/main';
import { buildSkill } from '@/features/analysis/model/skill';
import { registerMcpHandlers } from '@/features/mcp/main';
import { registerRepoHandlers } from '@/features/repo/main';
import { mcpDeps } from './mcp';

export function registerApplicationHandlers(): void {
  handleChannel(appInfoChannel, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }));

  registerRepoHandlers();
  const analyses = registerAnalysisHandlers();
  const mcp = registerMcpHandlers(mcpDeps(analyses));
  registerAgentHandlers({ mcpUrl: mcp.url, skill: buildSkill });
}
