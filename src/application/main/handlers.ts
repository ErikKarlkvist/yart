import { app, BrowserWindow } from 'electron';
import { appInfoChannel, titleBarThemeChannel } from '@/application/ipc/channels';
import { handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import { type AgentHandle, registerAgentHandlers } from '@/features/agent/main';
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
  handleChannel(titleBarThemeChannel, ({ dark }) => {
    if (process.platform !== 'win32') return;
    for (const window of BrowserWindow.getAllWindows()) {
      window.setTitleBarOverlay({
        color: dark ? '#161a22' : '#ffffff',
        symbolColor: dark ? '#e6e8ee' : '#1c2230',
        height: 38,
      });
    }
  });

  registerRepoHandlers();
  const analyses = registerAnalysisHandlers();
  // Agenten registreras efter MCP-servern men svarar på dess godkännanden, därav den sena bindningen.
  let agent: AgentHandle | null = null;
  const mcp = registerMcpHandlers({
    ...mcpDeps(analyses),
    requestApproval: (conversationId, request) =>
      agent
        ? agent.requestApproval(conversationId, request)
        : Promise.resolve({ allow: false, message: t('agent.approvalUnknown') }),
    nameConversation: async (conversationId, title) => {
      await agent?.nameConversation(conversationId, title);
    },
  });
  agent = registerAgentHandlers({ mcpUrl: mcp.url, skill: buildSkill });
}
