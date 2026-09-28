import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { mcpActivityEvent, mcpStatusChannel } from '../ipc/channels';
import { candidatePorts, MCP_ACTIVITY_LIMIT, type McpActivity } from '../model/mcp';
import { type McpDeps, type McpServerHandle, startMcpServer } from './server';

/** Startar MCP-servern vid appstart och svarar renderern på hur det gick. */
export function registerMcpHandlers(deps: Omit<McpDeps, 'onActivity'>): void {
  const activity: McpActivity[] = [];
  let handle: McpServerHandle | null = null;
  let error: string | null = null;

  handleChannel(mcpStatusChannel, () => ({
    url: handle?.url ?? null,
    sessions: handle?.sessions() ?? 0,
    activity: [...activity],
    error,
  }));

  const onActivity = (entry: McpActivity): void => {
    activity.unshift(entry);
    if (activity.length > MCP_ACTIVITY_LIMIT) activity.length = MCP_ACTIVITY_LIMIT;
    emitEvent(mcpActivityEvent, entry);
  };

  startMcpServer({ ...deps, onActivity }, { ports: candidatePorts(process.env.REVERIK_MCP_PORT) })
    .then((started) => {
      handle = started;
    })
    .catch((e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
      console.error(e);
    });

  app.on('before-quit', () => {
    void handle?.close();
  });
}
