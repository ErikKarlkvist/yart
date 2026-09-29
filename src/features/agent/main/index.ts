import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import { agentEvent, askAgentChannel, checkAgentChannel, stopAgentChannel } from '../ipc/channels';
import { type RunnableAgent } from '@/common/model/agent';
import { RUNNERS } from '../model/protocol';
import { checkAgent } from './check';
import { AgentSession } from './session';

/** Vad sessionerna behöver från resten av appen. */
export interface AgentDeps {
  /** MCP-serverns adress, null tills den lyssnar */
  mcpUrl: () => string | null;
  /** Skillen: systemprompt för Claude Code, inledning för Codex */
  skill: () => string;
}

export function registerAgentHandlers(deps: AgentDeps): void {
  const sessions = new Map<string, AgentSession>();

  const session = (repoPath: string, agent: RunnableAgent): AgentSession => {
    const key = `${agent}:${repoPath}`;
    const existing = sessions.get(key);
    if (existing) return existing;
    const created = new AgentSession(
      repoPath,
      RUNNERS[agent],
      () => {
        const mcpUrl = deps.mcpUrl();
        if (mcpUrl === null) throw new Error(t('agent.noServer'));
        return { mcpUrl, skill: deps.skill() };
      },
      {
        onEntry: (entry) => {
          emitEvent(agentEvent, { type: 'entry', repoPath, entry });
        },
        onState: (state) => {
          emitEvent(agentEvent, { type: 'state', repoPath, state });
        },
      },
    );
    sessions.set(key, created);
    return created;
  };

  handleChannel(askAgentChannel, ({ repoPath, agent, prompt }) => {
    if (agent === 'manual') {
      emitEvent(agentEvent, {
        type: 'entry',
        repoPath,
        entry: { at: new Date().toISOString(), kind: 'error', text: t('agent.unsupported') },
      });
      return;
    }
    session(repoPath, agent).ask(prompt);
  });
  handleChannel(stopAgentChannel, ({ repoPath }) => {
    for (const [key, running] of sessions) if (key.endsWith(`:${repoPath}`)) running.stop();
  });
  handleChannel(checkAgentChannel, ({ agent }) => checkAgent(agent));

  app.on('before-quit', () => {
    for (const running of sessions.values()) running.stop();
  });
}
