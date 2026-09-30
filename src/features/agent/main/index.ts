import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import { join } from 'node:path';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import { t } from '@/common/model/i18n';
import {
  agentEvent,
  answerApprovalChannel,
  askAgentChannel,
  checkAgentChannel,
  createConversationChannel,
  getConversationChannel,
  listConversationsChannel,
  stopAgentChannel,
} from '../ipc/channels';
import {
  AGENT_MODELS,
  AGENT_PERMISSIONS,
  type ApprovalDecision,
  type ApprovalRequest,
  type RunnableAgent,
} from '@/common/model/agent';
import { describeApproval } from '../model/approval';
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

export interface AgentHandle {
  /**
   * Frågar användaren om lov för det agenten i konversationen vill göra.
   * Svaret kommer när användaren trycker Allow eller Deny i panelen.
   */
  requestApproval: (conversationId: string, request: ApprovalRequest) => Promise<ApprovalDecision>;
  /** Sparar namnet agenten gett konversationen och visar det i panelen */
  nameConversation: (conversationId: string, title: string) => Promise<void>;
}

interface Waiting {
  repoPath: string;
  conversationId: string;
  resolve: (decision: ApprovalDecision) => void;
}

export function registerAgentHandlers(deps: AgentDeps): AgentHandle {
  const store = new ConversationStore(join(app.getPath('userData'), 'conversations'));
  const sessions = new Map<string, AgentSession>();
  const repoOf = new Map<string, string>();
  const waiting = new Map<string, Waiting>();

  const settle = (id: string, decision: ApprovalDecision): void => {
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    entry.resolve(decision);
    emitEvent(agentEvent, {
      type: 'approval-done',
      repoPath: entry.repoPath,
      conversationId: entry.conversationId,
      id,
    });
  };
  /** Nekar allt som väntar i konversationen, när den stoppas */
  const denyWaiting = (conversationId: string): void => {
    for (const [id, entry] of waiting)
      if (entry.conversationId === conversationId)
        settle(id, { allow: false, message: t('agent.approvalStopped') });
  };

  const session = (
    repoPath: string,
    conversationId: string,
    agent: RunnableAgent,
    threadId: string | null,
    instructions: string,
  ): AgentSession => {
    const existing = sessions.get(conversationId);
    if (existing) return existing;
    repoOf.set(conversationId, repoPath);
    const created = new AgentSession(
      repoPath,
      RUNNERS[agent],
      () => {
        const mcpUrl = deps.mcpUrl();
        if (mcpUrl === null) throw new Error(t('agent.noServer'));
        // MCP-servern behöver veta vilken konversation som namnger sig eller frågar om lov.
        // Bara Claude Code kan fråga om lov, Codex exec saknar det.
        const url = `${mcpUrl}?conversation=${encodeURIComponent(conversationId)}${
          agent === 'claude' ? '&permissions=1' : ''
        }`;
        return { mcpUrl: url, skill: `${deps.skill()}\n\n${instructions}` };
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
  handleChannel(askAgentChannel, async ({ repoPath, conversationId, prompt, settings }) => {
    if (!(AGENT_PERMISSIONS as readonly unknown[]).includes(settings.permission))
      throw new Error('Invalid agent permission mode');
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
    ).ask(prompt, {
      permission: settings.permission,
      // En modell agenten inte känner till faller tillbaka på standard
      model: AGENT_MODELS[conversation.agent].includes(settings.model) ? settings.model : 'default',
    });
  });
  handleChannel(stopAgentChannel, ({ conversationId }) => {
    denyWaiting(conversationId);
    sessions.get(conversationId)?.stop();
  });
  handleChannel(answerApprovalChannel, ({ id, allow }) => {
    settle(id, allow ? { allow: true } : { allow: false, message: t('agent.approvalDenied') });
  });
  handleChannel(checkAgentChannel, ({ agent }) => checkAgent(agent));

  app.on('before-quit', () => {
    for (const running of sessions.values()) running.stop();
  });

  return {
    nameConversation: async (conversationId, title) => {
      const repoPath = repoOf.get(conversationId);
      if (repoPath === undefined) return;
      await store.setTitle(repoPath, conversationId, title);
      emitEvent(agentEvent, { type: 'title', repoPath, conversationId, title });
    },
    requestApproval: (conversationId, request) => {
      const repoPath = repoOf.get(conversationId);
      if (repoPath === undefined)
        return Promise.resolve({ allow: false, message: t('agent.approvalUnknown') });
      const id = randomUUID();
      return new Promise((resolve) => {
        waiting.set(id, { repoPath, conversationId, resolve });
        emitEvent(agentEvent, {
          type: 'approval',
          repoPath,
          conversationId,
          approval: { id, tool: request.tool, detail: describeApproval(request.input) },
        });
      });
    },
  };
}
