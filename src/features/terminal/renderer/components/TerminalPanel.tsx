import '@xterm/xterm/css/xterm.css';
import { type JSX, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { invokeChannel, subscribeEvent } from '@/common/renderer/ipc';
import { useStoredChoice } from '@/common/renderer/useStored';
import {
  codexSessionEvent,
  listCodexChatsChannel,
  type CodexChatSummary,
} from '../../ipc/channels';
import { type Agent, AGENTS, agentStartCommand, codexInitialPrompt } from '../../model/agent';
import { useTerminalApi } from '../TerminalContext';
import { useTerminal, type TerminalPromptAction } from '../hooks/useTerminal';
import './terminal.css';

interface Props {
  /** Skalet startar i den här mappen. */
  repoPath: string | null;
  /** Används för att ge nya Codex-chattar en titel som går att känna igen. */
  repoName: string;
  /** Guiden agenten ska läsa, relativt repots rot. */
  guideFile: string;
  onHide: () => void;
  /** T.ex. ett draghandtag som ägs av appen. */
  children?: ReactNode;
}

const AGENT_LABELS: Readonly<Record<Agent, string>> = {
  claude: t('terminal.agent.claude'),
  codex: t('terminal.agent.codex'),
  shell: t('terminal.agent.shell'),
};

/** Terminal for an agent or shell, started in the selected repository. */
export function TerminalPanel({
  repoPath,
  repoName,
  guideFile,
  onHide,
  children,
}: Props): JSX.Element {
  const [agent, setAgent] = useStoredChoice<Agent>('reverik.agent', AGENTS, 'claude');

  return (
    <section className="terminal-panel">
      {children}
      {repoPath ? (
        <Shell
          key={`${repoPath}#${agent}`}
          repoPath={repoPath}
          repoName={repoName}
          agent={agent}
          guideFile={guideFile}
          onAgentChange={setAgent}
          onHide={onHide}
        />
      ) : (
        <>
          <Bar agent={agent} onAgentChange={setAgent} onHide={onHide} />
          <p className="shell__empty shell__empty--padded">{t('terminal.noRepo')}</p>
        </>
      )}
    </section>
  );
}

interface BarProps {
  agent: Agent;
  onAgentChange: (next: string) => void;
  onHide: () => void;
  onRestart?: (() => void) | undefined;
  onStartAgent?: (() => void) | undefined;
  chats?: readonly CodexChatSummary[] | undefined;
  chatId?: string | null;
  chatDisabled?: boolean;
  onChatChange?: ((id: string | null) => void) | undefined;
  startLabel?: string;
}

function Bar({
  agent,
  onAgentChange,
  onHide,
  onRestart,
  onStartAgent,
  chats,
  chatId,
  chatDisabled,
  onChatChange,
  startLabel,
}: BarProps): JSX.Element {
  return (
    <header className="terminal-panel__bar">
      <span className="terminal-panel__tools">
        <select
          className="terminal-panel__agent"
          value={agent}
          title={t('terminal.agentHint')}
          aria-label={t('terminal.agentLabel')}
          onChange={(event) => {
            onAgentChange(event.target.value);
          }}
        >
          {AGENTS.map((key) => (
            <option key={key} value={key}>
              {AGENT_LABELS[key]}
            </option>
          ))}
        </select>
        {agent === 'codex' && chats && onChatChange && (
          <select
            className="terminal-panel__chat"
            value={chatId ?? ''}
            disabled={chatDisabled}
            title={t('terminal.chatHint')}
            aria-label={t('terminal.chatLabel')}
            onChange={(event) => {
              onChatChange(event.target.value || null);
            }}
          >
            <option value="">{t('terminal.newChat')}</option>
            {chats.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title} ·{' '}
                {new Date(chat.updatedAt).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </option>
            ))}
          </select>
        )}
        {onStartAgent && (
          <button
            type="button"
            className="icon-button icon-button--quiet"
            title={startLabel ?? t('terminal.startAgent')}
            aria-label={startLabel ?? t('terminal.startAgent')}
            onClick={onStartAgent}
          >
            <Icon name="play" size="sm" />
          </button>
        )}
        {onRestart && (
          <button
            type="button"
            className="icon-button icon-button--quiet"
            title={t('terminal.restart')}
            aria-label={t('terminal.restart')}
            onClick={onRestart}
          >
            <Icon name="restart" size="sm" />
          </button>
        )}
        <button
          type="button"
          className="icon-button icon-button--quiet"
          title={t('panel.minimiseTerminal')}
          aria-label={t('panel.minimiseTerminal')}
          onClick={onHide}
        >
          <Icon name="chevronRight" size="sm" />
        </button>
      </span>
    </header>
  );
}

interface ShellProps {
  repoPath: string;
  repoName: string;
  agent: Agent;
  guideFile: string;
  onAgentChange: (next: string) => void;
  onHide: () => void;
}

function Shell({
  repoPath,
  repoName,
  agent,
  guideFile,
  onAgentChange,
  onHide,
}: ShellProps): JSX.Element {
  const screen = useRef<HTMLDivElement | null>(null);
  const { tabId: currentTabId, codexSessionForRepo, rememberCodexSession } = useTerminalApi();
  const [storedChatId, setSelectedChatId] = useState(() => codexSessionForRepo(repoPath));
  const [chats, setChats] = useState<readonly CodexChatSummary[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const selectedChatId =
    chatsLoaded && storedChatId && !chats.some((chat) => chat.id === storedChatId)
      ? null
      : storedChatId;
  const startCommand = agent === 'codex' ? null : agentStartCommand(agent, guideFile);
  const [agentStarted, setAgentStarted] = useState(() => startCommand !== null);
  const agentStartedRef = useRef(startCommand !== null);
  const refreshChats = useCallback(() => {
    void invokeChannel(listCodexChatsChannel, { repoPath })
      .then((nextChats) => {
        setChats(nextChats);
        setChatsLoaded(true);
      })
      .catch(() => {
        setChats([]);
      });
  }, [repoPath]);
  useEffect(() => {
    refreshChats();
    return subscribeEvent(codexSessionEvent, (event) => {
      if (event.repoPath !== repoPath) return;
      refreshChats();
      if (event.tabId === currentTabId) setSelectedChatId(event.sessionId);
    });
  }, [currentTabId, refreshChats, repoPath]);
  const onPrompt = useCallback(
    (prompt: string): TerminalPromptAction => {
      if (agent !== 'codex' || agentStartedRef.current) return { type: 'shell' };

      agentStartedRef.current = true;
      setAgentStarted(true);
      return {
        type: 'codex',
        prompt: selectedChatId
          ? prompt
          : codexInitialPrompt(guideFile, repoName, currentTabId, prompt),
        sessionId: selectedChatId,
      };
    },
    [agent, currentTabId, guideFile, repoName, selectedChatId],
  );
  const { exitCode, ready, restart, run, startCodex } = useTerminal(
    repoPath,
    screen,
    agent,
    startCommand,
    onPrompt,
  );
  const restartTerminal = useCallback(() => {
    agentStartedRef.current = false;
    setAgentStarted(false);
    restart();
  }, [restart]);
  const selectChat = useCallback(
    (sessionId: string | null) => {
      setSelectedChatId(sessionId);
      rememberCodexSession(repoPath, sessionId);
    },
    [rememberCodexSession, repoPath],
  );
  const startAgent = useCallback(() => {
    if (agentStartedRef.current) return;
    agentStartedRef.current = true;
    setAgentStarted(true);
    if (agent === 'codex') {
      startCodex(
        selectedChatId ? null : codexInitialPrompt(guideFile, repoName, currentTabId),
        selectedChatId,
      );
      return;
    }
    const command = agentStartCommand(agent, guideFile);
    if (command) run(command);
  }, [agent, currentTabId, guideFile, repoName, run, selectedChatId, startCodex]);

  return (
    <>
      <Bar
        agent={agent}
        onAgentChange={onAgentChange}
        onHide={onHide}
        chats={agent === 'codex' ? chats : undefined}
        chatId={selectedChatId}
        chatDisabled={agentStarted}
        onChatChange={selectChat}
        startLabel={
          agent === 'codex' && selectedChatId ? t('terminal.resumeChat') : t('terminal.startAgent')
        }
        onRestart={restartTerminal}
        onStartAgent={
          agent !== 'shell' && ready && exitCode === null && !agentStarted ? startAgent : undefined
        }
      />
      {agent === 'shell' && (
        <p className="terminal-panel__hint">{t('terminal.shellHint', { guide: guideFile })}</p>
      )}
      <div className="terminal-panel__screen" ref={screen} />
      {exitCode !== null && (
        <div className="terminal-panel__exited">
          <span>{t('terminal.exited', { code: exitCode })}</span>
          <button type="button" onClick={restartTerminal}>
            {t('terminal.restart')}
          </button>
        </div>
      )}
    </>
  );
}
