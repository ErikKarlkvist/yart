import { type JSX, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import {
  AGENT_KINDS,
  type AgentKind,
  codexConfigSnippet,
  connectCommand,
} from '../../model/agents';
import { type McpState } from '../useMcpStatus';
import { CommandCopy } from './CommandCopy';
import { SkillInstall } from './SkillInstall';

interface Props {
  mcp: McpState;
  /** Vilken extern agent instruktionerna gäller */
  agent: AgentKind;
  onAgent: (agent: AgentKind) => void;
  /** Visa sökvägen skillen skrivs till */
  showPath: boolean;
}

/**
 * Väljaren för extern agent och de två stegen som beror på den: koppla
 * servern och ge agenten guiden. Delas av förstagångsguiden och Anslut-panelen.
 */
export function AgentSetup({ mcp, agent, onAgent, showPath }: Props): JSX.Element {
  const { status } = mcp;
  const [guideCopied, setGuideCopied] = useState(false);

  useEffect(() => {
    if (!guideCopied) return;
    const id = setTimeout(() => {
      setGuideCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [guideCopied]);

  const copyGuide = (): void => {
    mcp
      .skillText()
      .then((text) => navigator.clipboard.writeText(text))
      .then(() => {
        setGuideCopied(true);
      })
      .catch(console.error);
  };

  const command = status?.url ? connectCommand(agent, status.url) : null;

  return (
    <>
      <div className="agent-picker" role="radiogroup" aria-label={t('setup.chooseAgent')}>
        {AGENT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={agent === kind}
            className={`agent-picker__option${agent === kind ? ' is-active' : ''}`}
            onClick={() => {
              onAgent(kind);
            }}
          >
            {t(`agent.${kind}`)}
          </button>
        ))}
      </div>

      <section className="setup__step">
        <h3 className="setup__step-title">{t(`setup.connectTitle.${agent}`)}</h3>
        <p className="setup__text">{t(`setup.connectText.${agent}`)}</p>
        {status?.url ? (
          <>
            {command ? <CommandCopy command={command} /> : <CommandCopy command={status.url} />}
            {agent === 'codex' && (
              <>
                <p className="setup__text">{t('setup.codexConfig')}</p>
                <CommandCopy command={codexConfigSnippet(status.url)} />
              </>
            )}
          </>
        ) : (
          <p className="connect__muted">
            {status?.error ? t('app.mcpFailed', { error: status.error }) : t('app.mcpStarting')}
          </p>
        )}
      </section>

      <section className="setup__step">
        <h3 className="setup__step-title">{t(`setup.guideTitle.${agent}`)}</h3>
        <p className="setup__text">{t(`setup.guideText.${agent}`)}</p>
        {agent === 'manual' ? (
          <div className="connect__command">
            <code className="connect__code">reverik://guide</code>
            <button type="button" className="text-button" onClick={copyGuide}>
              <Icon name="copy" size="sm" />{' '}
              {guideCopied ? t('setup.guideCopied') : t('setup.copyGuide')}
            </button>
          </div>
        ) : (
          status && (
            <SkillInstall
              skill={status.skills[agent]}
              onInstall={() => mcp.installSkill(agent)}
              showPath={showPath}
            />
          )
        )}
      </section>
    </>
  );
}
