import '@xterm/xterm/css/xterm.css';
import { type JSX, type ReactNode, useCallback, useRef, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useStoredChoice } from '@/common/renderer/useStored';
import { type Agent, AGENTS, agentStartCommand } from '../../model/agent';
import { useTerminalApi } from '../TerminalContext';
import { useTerminal } from '../hooks/useTerminal';
import './terminal.css';

interface Props {
  /** Skalet startar i den här mappen. */
  repoPath: string | null;
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

/**
 * Terminal för valfri AI-agent, startad i repots rot. Vald agent sparas
 * mellan starter. Byte av agent ger nytt startkommando, och skalet startar om.
 */
export function TerminalPanel({ repoPath, guideFile, onHide, children }: Props): JSX.Element {
  const [agent, setAgent] = useStoredChoice<Agent>('reverik.agent', AGENTS, 'claude');

  return (
    <section className="terminal-panel">
      {children}
      {repoPath ? (
        <Shell
          key={`${repoPath}#${agent}`}
          repoPath={repoPath}
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
}

function Bar({ agent, onAgentChange, onHide, onRestart, onStartAgent }: BarProps): JSX.Element {
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
        {onStartAgent && (
          <button
            type="button"
            className="icon-button icon-button--quiet"
            title={t('terminal.startAgent')}
            aria-label={t('terminal.startAgent')}
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
  agent: Agent;
  guideFile: string;
  onAgentChange: (next: string) => void;
  onHide: () => void;
}

function Shell({ repoPath, agent, guideFile, onAgentChange, onHide }: ShellProps): JSX.Element {
  const screen = useRef<HTMLDivElement | null>(null);
  const { codexSessionForRepo } = useTerminalApi();
  const [codexSessionId, setCodexSessionId] = useState(() => codexSessionForRepo(repoPath));
  const startCommand = agentStartCommand(agent, guideFile, codexSessionId);
  const { exitCode, restart, run, startCodex } = useTerminal(
    repoPath,
    screen,
    agent,
    startCommand,
    codexSessionId,
  );
  const restartTerminal = useCallback(() => {
    setCodexSessionId(codexSessionForRepo(repoPath));
    restart();
  }, [codexSessionForRepo, repoPath, restart]);
  const startAgent = useCallback(() => {
    const sessionId = agent === 'codex' ? codexSessionForRepo(repoPath) : null;
    const command = agentStartCommand(agent, guideFile, sessionId);
    if (!command) return;
    if (agent === 'codex') startCodex(command, sessionId);
    else run(command);
  }, [agent, codexSessionForRepo, guideFile, repoPath, run, startCodex]);

  return (
    <>
      <Bar
        agent={agent}
        onAgentChange={onAgentChange}
        onHide={onHide}
        onRestart={restartTerminal}
        onStartAgent={startCommand && exitCode === null ? startAgent : undefined}
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
