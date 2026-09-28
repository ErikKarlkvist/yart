import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { installSkillChannel, mcpActivityEvent, mcpStatusChannel } from '../ipc/channels';
import { candidatePorts, MCP_ACTIVITY_LIMIT, type McpActivity, type McpStatus } from '../model/mcp';
import { type McpDeps, type McpServerHandle, startMcpServer } from './server';
import { installSkill, skillPath, skillState } from './skill';

export type McpRegistration = Omit<McpDeps, 'onActivity'>;

/** Startar MCP-servern vid appstart och svarar renderern på hur det gick. */
export function registerMcpHandlers(deps: McpRegistration): void {
  const activity: McpActivity[] = [];
  let handle: McpServerHandle | null = null;
  let error: string | null = null;
  const path = skillPath(app.getPath('home'));

  const status = async (): Promise<McpStatus> => ({
    url: handle?.url ?? null,
    sessions: handle?.sessions() ?? 0,
    activity: [...activity],
    error,
    skill: { path, state: await skillState(path, deps.skill()) },
  });

  handleChannel(mcpStatusChannel, status);
  handleChannel(installSkillChannel, async () => {
    await installSkill(path, deps.skill());
    return status();
  });

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
