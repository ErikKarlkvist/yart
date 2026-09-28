import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import { agentEvent, askAgentChannel, checkAgentChannel, stopAgentChannel } from '../ipc/channels';
import { claudeLaunch } from '../model/protocol';
import { checkClaude } from './check';
import { AgentSession } from './session';

/** Vad sessionerna behöver från resten av appen. */
export interface AgentDeps {
  /** MCP-serverns adress, null tills den lyssnar */
  mcpUrl: () => string | null;
  /** Skillen, som blir systemprompt för den headless sessionen */
  skill: () => string;
}

export function registerAgentHandlers(deps: AgentDeps): void {
  const sessions = new Map<string, AgentSession>();

  const session = (repoPath: string): AgentSession => {
    const existing = sessions.get(repoPath);
    if (existing) return existing;
    const created = new AgentSession(
      repoPath,
      () => {
        const url = deps.mcpUrl();
        if (url === null) throw new Error(t('agent.noServer'));
        return claudeLaunch(url, deps.skill());
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
    sessions.set(repoPath, created);
    return created;
  };

  handleChannel(askAgentChannel, ({ repoPath, agent, prompt }) => {
    if (agent !== 'claude') {
      emitEvent(agentEvent, {
        type: 'entry',
        repoPath,
        entry: { at: new Date().toISOString(), kind: 'error', text: t('agent.unsupported') },
      });
      return;
    }
    session(repoPath).ask(prompt);
  });
  handleChannel(stopAgentChannel, ({ repoPath }) => {
    sessions.get(repoPath)?.stop();
  });
  handleChannel(checkAgentChannel, () => checkClaude());

  app.on('before-quit', () => {
    for (const running of sessions.values()) running.stop();
  });
}
