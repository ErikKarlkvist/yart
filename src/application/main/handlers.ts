import { app } from 'electron';
import { appInfoChannel } from '@/application/ipc/channels';
import { handleChannel } from '@/common/main/ipc';
import { registerAnalysisHandlers } from '@/features/analysis/main';
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
  registerMcpHandlers(mcpDeps(analyses));
}
