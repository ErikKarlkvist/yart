import { app } from 'electron';
import { join } from 'node:path';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import {
  agentEvent,
  askAgentChannel,
  checkAgentChannel,
  createConversationChannel,
  getConversationChannel,
  listConversationsChannel,
  stopAgentChannel,
} from '../ipc/channels';
import { ACCESS_MODES, APPROVAL_POLICIES, type RunnableAgent } from '@/common/model/agent';
import { RUNNERS } from '../model/protocol';
import { checkAgent } from './check';
import { AgentSession } from './session';
import { ConversationStore } from './conversations';
import { conversationInstructions } from '../model/conversationInstructions';

/** Vad sessionerna behöver från resten av appen. */
export interface AgentDeps {
  /** MCP-serverns adress, null tills den lyssnar */
  mcpUrl: () => string | null;
  /** Skillen: systemprompt för Claude Code, inledning för Codex */
  skill: () => string;
}

export function registerAgentHandlers(deps: AgentDeps): void {
  const store = new ConversationStore(join(app.getPath('userData'), 'conversations'));
  const sessions = new Map<string, AgentSession>();

  const session = (
    repoPath: string,
    conversationId: string,
    agent: RunnableAgent,
    threadId: string | null,
    instructions: string,
  ): AgentSession => {
    const existing = sessions.get(conversationId);
    if (existing) return existing;
    const created = new AgentSession(
      repoPath,
      RUNNERS[agent],
      () => {
        const mcpUrl = deps.mcpUrl();
        if (mcpUrl === null) throw new Error(t('agent.noServer'));
        return { mcpUrl, skill: `${deps.skill()}\n\n${instructions}` };
      },
      {
        onEntry: (entry) => {
          void store.append(repoPath, conversationId, entry).catch(console.error);
          emitEvent(agentEvent, { type: 'entry', repoPath, conversationId, entry });
        },
        onState: (state) => {
          emitEvent(agentEvent, { type: 'state', repoPath, conversationId, state });
        },
        onThread: (id) => {
          void store.setThread(repoPath, conversationId, id).catch(console.error);
        },
      },
      threadId,
    );
    sessions.set(conversationId, created);
    return created;
  };

  handleChannel(listConversationsChannel, ({ repoPath }) => store.list(repoPath));
  handleChannel(getConversationChannel, ({ repoPath, id }) => store.get(repoPath, id));
  handleChannel(createConversationChannel, ({ repoPath, agent, mode, reviewBranches }) =>
    store.create(repoPath, agent, mode, reviewBranches),
  );
  handleChannel(
    askAgentChannel,
    async ({ repoPath, conversationId, prompt, approvalPolicy, accessMode }) => {
      if (!(ACCESS_MODES as readonly unknown[]).includes(accessMode))
        throw new Error('Invalid agent access mode');
      if (!(APPROVAL_POLICIES as readonly unknown[]).includes(approvalPolicy))
        throw new Error('Invalid approval policy');
      const conversation = await store.get(repoPath, conversationId);
      if (!conversation) throw new Error('Conversation not found');
      if (conversation.agent === 'manual') {
        const entry = {
          at: new Date().toISOString(),
          kind: 'error' as const,
          text: t('agent.unsupported'),
        };
        const question = { at: entry.at, kind: 'user' as const, text: prompt };
        await store.append(repoPath, conversationId, question);
        await store.append(repoPath, conversationId, entry);
        emitEvent(agentEvent, { type: 'entry', repoPath, conversationId, entry: question });
        emitEvent(agentEvent, {
          type: 'entry',
          repoPath,
          conversationId,
          entry,
        });
        return;
      }
      session(
        repoPath,
        conversationId,
        conversation.agent,
        conversation.threadId,
        conversationInstructions(conversation.mode, conversation.reviewBranches),
      ).ask(prompt, approvalPolicy, accessMode);
    },
  );
  handleChannel(stopAgentChannel, ({ conversationId }) => {
    sessions.get(conversationId)?.stop();
  });
  handleChannel(checkAgentChannel, ({ agent }) => checkAgent(agent));

  app.on('before-quit', () => {
    for (const running of sessions.values()) running.stop();
  });
}
