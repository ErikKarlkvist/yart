import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import {
  installSkillChannel,
  mcpActivityEvent,
  mcpStatusChannel,
  skillTextChannel,
} from '../ipc/channels';
import { type SkillTarget } from '../model/agents';
import {
  candidatePorts,
  MCP_ACTIVITY_LIMIT,
  type McpActivity,
  type McpStatus,
  type SkillStatus,
} from '../model/mcp';
import { type McpDeps, type McpServerHandle, startMcpServer } from './server';
import { installSkill, skillPath, skillState } from './skill';
import { errorMessage } from '@/common/model/json';

export type McpRegistration = Omit<McpDeps, 'onActivity'>;

export interface McpHandle {
  /** Adressen servern lyssnar på, null tills den startat */
  url: () => string | null;
}

/** Startar MCP-servern vid appstart och svarar renderern på hur det gick. */
export function registerMcpHandlers(deps: McpRegistration): McpHandle {
  const activity: McpActivity[] = [];
  let handle: McpServerHandle | null = null;
  let error: string | null = null;
  const home = app.getPath('home');

  const skillStatus = async (target: SkillTarget): Promise<SkillStatus> => {
    const path = skillPath(home, target);
    return { path, state: await skillState(path, deps.skill()) };
  };
  const status = async (): Promise<McpStatus> => ({
    url: handle?.url ?? null,
    sessions: handle?.sessions() ?? 0,
    activity: [...activity],
    error,
    skills: { claude: await skillStatus('claude'), codex: await skillStatus('codex') },
  });

  handleChannel(mcpStatusChannel, status);
  handleChannel(installSkillChannel, async ({ target }) => {
    await installSkill(skillPath(home, target), deps.skill());
    return status();
  });
  handleChannel(skillTextChannel, () => deps.skill());

  const onActivity = (entry: McpActivity): void => {
    activity.unshift(entry);
    if (activity.length > MCP_ACTIVITY_LIMIT) activity.length = MCP_ACTIVITY_LIMIT;
    emitEvent(mcpActivityEvent, entry);
  };

  startMcpServer({ ...deps, onActivity }, { ports: candidatePorts(process.env.YART_MCP_PORT) })
    .then((started) => {
      handle = started;
    })
    .catch((e: unknown) => {
      error = errorMessage(e);
      console.error(e);
    });

  app.on('before-quit', () => {
    void handle?.close();
  });

  return { url: () => handle?.url ?? null };
}
