import { type JSX, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { invokeChannel } from '@/common/renderer/ipc';
import { useIpcEvent } from '@/common/renderer/useIpcEvent';
import { readStored, useScopedKey, writeStored } from '@/common/renderer/storage';
import {
  type AccessMode,
  type AgentKind,
  type ApprovalPolicy,
  type RunnableAgent,
} from '@/common/model/agent';
import { type AgentEntry, type AgentState } from '../model/protocol';
import {
  type Conversation,
  type ConversationMode,
  type ConversationSummary,
  type ReviewBranches,
} from '../model/conversation';
import {
  agentEvent,
  askAgentChannel,
  createConversationChannel,
  getConversationChannel,
  listConversationsChannel,
  stopAgentChannel,
  type AgentEvent,
} from '../ipc/channels';
import { AgentContext } from './AgentContext';

interface Props {
  repoPath: string | null;
  agent: AgentKind;
  approvalPolicy: ApprovalPolicy;
  accessModes: Readonly<Record<RunnableAgent, AccessMode>>;
  children: ReactNode;
}
interface Tagged<T> {
  repoPath: string;
  value: T;
}
interface OpenConversation {
  id: string;
  entries: AgentEntry[];
  loaded: boolean;
}

/** Lists load first; message history is fetched only for the opened conversation. */
export function AgentProvider({
  repoPath,
  agent,
  approvalPolicy,
  accessModes,
  children,
}: Props): JSX.Element {
  const selectionKey = useScopedKey('reverik.conversation');
  const [conversations, setConversations] = useState<Tagged<ConversationSummary[]> | null>(null);
  const [selected, setSelected] = useState<Tagged<string> | null>(null);
  const [opened, setOpened] = useState<Tagged<OpenConversation> | null>(null);
  const [states, setStates] = useState<Tagged<Record<string, AgentState>> | null>(null);
  const [draftMode, setDraftMode] = useState<Tagged<ConversationMode | null> | null>(null);
  const selectedRef = useRef<{ repoPath: string; id: string } | null>(null);
  const newDraftRepoRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const activeId = selected?.repoPath === repoPath ? selected.value : null;

  const choose = useCallback(
    (id: string) => {
      if (!repoPath) return;
      if (selectedRef.current?.repoPath === repoPath && selectedRef.current.id === id) return;
      selectedRef.current = { repoPath, id };
      newDraftRepoRef.current = null;
      setDraftMode(null);
      setSelected({ repoPath, value: id });
      setOpened((current) =>
        current?.repoPath === repoPath && current.value.id === id ? current : null,
      );
      writeStored(selectionKey, id);
    },
    [repoPath, selectionKey],
  );

  const startNew = useCallback(() => {
    if (!repoPath) return;
    newDraftRepoRef.current = repoPath;
    selectedRef.current = null;
    setSelected(null);
    setOpened(null);
    setDraftMode({ repoPath, value: null });
    writeStored(selectionKey, null);
  }, [repoPath, selectionKey]);

  const selectMode = useCallback(
    (mode: ConversationMode) => {
      if (repoPath && !activeId) setDraftMode({ repoPath, value: mode });
    },
    [repoPath, activeId],
  );

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    void invokeChannel(listConversationsChannel, { repoPath })
      .then((list) => {
        if (cancelled) return;
        setConversations((current) => ({
          repoPath,
          value: [
            ...(current?.repoPath === repoPath
              ? current.value.filter((item) => !list.some((saved) => saved.id === item.id))
              : []),
            ...list,
          ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }));
        const previous = readStored(selectionKey);
        const inFlight = selectedRef.current?.repoPath === repoPath ? selectedRef.current.id : null;
        const id =
          newDraftRepoRef.current === repoPath
            ? null
            : (inFlight ?? list.find((item) => item.id === previous)?.id ?? list[0]?.id ?? null);
        selectedRef.current = id ? { repoPath, id } : null;
        setSelected(id ? { repoPath, value: id } : null);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [repoPath, selectionKey]);

  useEffect(() => {
    if (
      !repoPath ||
      !activeId ||
      (opened?.repoPath === repoPath && opened.value.id === activeId && opened.value.loaded)
    )
      return;
    let cancelled = false;
    void invokeChannel(getConversationChannel, { repoPath, id: activeId })
      .then((conversation) => {
        if (
          !cancelled &&
          selectedRef.current?.repoPath === repoPath &&
          selectedRef.current.id === activeId &&
          conversation
        )
          setOpened((current) => {
            const buffered =
              current?.repoPath === repoPath && current.value.id === activeId
                ? current.value.entries
                : [];
            const saved = new Set(conversation.entries.map((entry) => JSON.stringify(entry)));
            return {
              repoPath,
              value: {
                id: activeId,
                loaded: true,
                entries: [
                  ...conversation.entries,
                  ...buffered.filter((entry) => !saved.has(JSON.stringify(entry))),
                ],
              },
            };
          });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [repoPath, activeId, opened]);

  const onEvent = useCallback(
    (event: AgentEvent) => {
      if (event.repoPath !== repoPath) return;
      if (event.type === 'entry') {
        setConversations((current) => {
          if (current?.repoPath !== repoPath) return current;
          const list = current.value.map((item) =>
            item.id === event.conversationId
              ? {
                  ...item,
                  title:
                    item.title ||
                    (event.entry.kind === 'user' ? event.entry.text.trim().slice(0, 70) : ''),
                  updatedAt: event.entry.at,
                }
              : item,
          );
          return {
            repoPath,
            value: [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          };
        });
        if (
          selectedRef.current?.repoPath !== repoPath ||
          selectedRef.current.id !== event.conversationId
        )
          return;
        setOpened((current) => {
          const list =
            current?.repoPath === repoPath && current.value.id === event.conversationId
              ? current.value.entries
              : [];
          const previous = list.at(-1);
          const duplicate =
            event.entry.kind === 'error' &&
            previous?.kind === 'assistant' &&
            previous.text === event.entry.text;
          return {
            repoPath,
            value: {
              id: event.conversationId,
              loaded:
                current?.repoPath === repoPath && current.value.id === event.conversationId
                  ? current.value.loaded
                  : false,
              entries: [...(duplicate ? list.slice(0, -1) : list), event.entry],
            },
          };
        });
      } else {
        setStates((current) => ({
          repoPath,
          value: {
            ...(current?.repoPath === repoPath ? current.value : {}),
            [event.conversationId]: event.state,
          },
        }));
      }
    },
    [repoPath],
  );
  useIpcEvent(agentEvent, onEvent);

  const create = useCallback(
    async (
      mode: ConversationMode,
      reviewBranches?: ReviewBranches,
    ): Promise<Conversation | null> => {
      if (!repoPath) return null;
      const conversation = await invokeChannel(createConversationChannel, {
        repoPath,
        agent,
        mode,
        ...(reviewBranches ? { reviewBranches } : {}),
      });
      setConversations((current) => ({
        repoPath,
        value: [conversation, ...(current?.repoPath === repoPath ? current.value : [])],
      }));
      setOpened({ repoPath, value: { id: conversation.id, entries: [], loaded: true } });
      choose(conversation.id);
      return conversation;
    },
    [repoPath, agent, choose],
  );

  const ask = useCallback(
    (prompt: string, reviewBranches?: ReviewBranches) => {
      if (!repoPath) return;
      if (creatingRef.current) return;
      void (async () => {
        const currentId =
          selectedRef.current?.repoPath === repoPath ? selectedRef.current.id : null;
        if (!currentId) creatingRef.current = true;
        try {
          const mode =
            draftMode?.repoPath === repoPath ? (draftMode.value ?? 'analyse') : 'analyse';
          const conversation = currentId ? null : await create(mode, reviewBranches);
          const conversationId = currentId ?? conversation?.id;
          const currentAgent =
            currentId && conversations?.repoPath === repoPath
              ? (conversations.value.find((item) => item.id === currentId)?.agent ?? agent)
              : agent;
          if (conversationId)
            await invokeChannel(askAgentChannel, {
              repoPath,
              agent: currentAgent,
              approvalPolicy,
              accessMode: currentAgent === 'manual' ? 'read-only' : accessModes[currentAgent],
              prompt,
              conversationId,
            });
        } finally {
          if (!currentId) creatingRef.current = false;
        }
      })().catch(console.error);
    },
    [repoPath, agent, approvalPolicy, accessModes, conversations, create, draftMode],
  );
  // En ny konversation i läget, med frågan som första meddelande. För planer som skickas från ett dokument.
  const askNew = useCallback(
    (prompt: string, mode: ConversationMode) => {
      if (!repoPath || creatingRef.current) return;
      creatingRef.current = true;
      void (async () => {
        try {
          const conversation = await create(mode);
          if (conversation)
            await invokeChannel(askAgentChannel, {
              repoPath,
              agent,
              approvalPolicy,
              accessMode: agent === 'manual' ? 'read-only' : accessModes[agent],
              prompt,
              conversationId: conversation.id,
            });
        } finally {
          creatingRef.current = false;
        }
      })().catch(console.error);
    },
    [repoPath, agent, approvalPolicy, accessModes, create],
  );
  const stop = useCallback(() => {
    if (repoPath && activeId)
      void invokeChannel(stopAgentChannel, { repoPath, conversationId: activeId }).catch(
        console.error,
      );
  }, [repoPath, activeId]);

  const list = conversations?.repoPath === repoPath ? conversations.value : [];
  const mode = activeId
    ? (list.find((item) => item.id === activeId)?.mode ?? 'general')
    : draftMode?.repoPath === repoPath
      ? draftMode.value
      : null;
  const entries =
    opened?.repoPath === repoPath && opened.value.id === activeId ? opened.value.entries : [];
  const currentState =
    activeId && states?.repoPath === repoPath ? (states.value[activeId] ?? 'stopped') : 'stopped';
  const lastPrompt = [...entries].reverse().find((entry) => entry.kind === 'user');
  const api = {
    conversations: list,
    activeId,
    mode,
    entries,
    state: currentState,
    lastPrompt: lastPrompt?.kind === 'user' ? lastPrompt.text : null,
    choose,
    startNew,
    selectMode,
    ask,
    askNew,
    stop,
  };
  return <AgentContext.Provider value={api}>{children}</AgentContext.Provider>;
}
