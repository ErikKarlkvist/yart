import { type JSX, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { type RunnableAgent, useAgentCheck } from '@/features/agent';
import { AGENT_KINDS, type AgentKind } from '../../model/agents';
import { useSetup } from '../SetupContext';
import { useMcpStatus } from '../useMcpStatus';
import { AgentSetup } from './AgentSetup';
import { CommandCopy } from './CommandCopy';
import './connect.css';
import './onboarding.css';

const EXAMPLES = ['onboarding.example1', 'onboarding.example2', 'onboarding.example3'] as const;

const INSTALL_COMMANDS: Readonly<Record<RunnableAgent, string>> = {
  claude: 'brew install --cask claude-code',
  codex: 'npm install -g @openai/codex',
};
const LOGIN_COMMANDS: Readonly<Record<RunnableAgent, string>> = {
  claude: 'claude auth login',
  codex: 'codex login',
};

/**
 * Förstagångsguiden med tre vägar: Claude Code eller Codex som appen kör i
 * bakgrunden, eller en extern AI som kopplas via MCP. Valet är det appen
 * sedan använder. Ligger över hela appen tills den stängts, och öppnas
 * igen från sidfoten.
 */
export function Onboarding(): JSX.Element | null {
  const { guideOpen, dismissGuide, agent, setAgent } = useSetup();

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismissGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [guideOpen, dismissGuide]);

  if (!guideOpen) return null;

  return (
    <div className="onboarding" role="presentation">
      <div
        className="onboarding__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <h2 id="onboarding-title" className="onboarding__title">
          {t('onboarding.title')}
        </h2>
        <p className="onboarding__intro">{t('onboarding.intro')}</p>

        <div className="agent-picker agent-picker--wide" role="tablist">
          {AGENT_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={agent === kind}
              className={`agent-picker__option${agent === kind ? ' is-active' : ''}`}
              onClick={() => {
                setAgent(kind);
              }}
            >
              {t(`onboarding.path.${kind}`)}
            </button>
          ))}
        </div>

        {agent === 'manual' ? <ExternalPath /> : <BuiltInPath agent={agent} />}

        <p className="onboarding__outro">{t('onboarding.outro')}</p>
        <div className="onboarding__actions">
          <button type="button" className="onboarding__done" onClick={dismissGuide}>
            {t('onboarding.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Agenten appen kör själv: kontroll att den finns och är inloggad, sedan hur man frågar. */
function BuiltInPath({ agent }: { agent: RunnableAgent }): JSX.Element {
  const { check, refresh } = useAgentCheck(agent);
  const ready = check?.installed === true && check.loggedIn;
  const name = t(`agent.${agent}`);

  return (
    <>
      <section className="setup__step">
        <h3 className="setup__step-title">{t('onboarding.builtinTitle', { name })}</h3>
        <p className="setup__text">{t('onboarding.builtinText', { name, command: agent })}</p>
        <div className="connect__command">
          <span className={`onboarding__check${ready ? ' is-ok' : check ? ' is-bad' : ''}`}>
            {check === null ? (
              t('onboarding.checking', { name })
            ) : !check.installed ? (
              <>
                <Icon name="error" size="sm" /> {t('onboarding.notInstalled', { name })}
              </>
            ) : !check.loggedIn ? (
              <>
                <Icon name="warning" size="sm" />{' '}
                {t('onboarding.notLoggedIn', { name, version: check.version ?? '' })}
              </>
            ) : (
              <>
                <Icon name="info" size="sm" />{' '}
                {t('onboarding.ready', { name, version: check.version ?? '' })}
              </>
            )}
          </span>
          <button type="button" className="text-button" onClick={refresh}>
            {t('onboarding.recheck')}
          </button>
        </div>
        {check && !check.installed && (
          <>
            <p className="setup__text">{t(`onboarding.installHint.${agent}`)}</p>
            <CommandCopy command={INSTALL_COMMANDS[agent]} />
          </>
        )}
        {check?.installed && !check.loggedIn && (
          <>
            <p className="setup__text">{t('onboarding.loginHint')}</p>
            <CommandCopy command={LOGIN_COMMANDS[agent]} />
          </>
        )}
      </section>

      <section className="setup__step">
        <h3 className="setup__step-title">{t('onboarding.askTitle')}</h3>
        <p className="setup__text">{t('onboarding.askText')}</p>
        <ul className="onboarding__examples">
          {EXAMPLES.map((key) => (
            <li key={key}>
              <code className="connect__code">{t(key)}</code>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Extern AI: koppla den till MCP-servern och ge den guiden, sedan fråga från dess terminal. */
function ExternalPath(): JSX.Element {
  const mcp = useMcpStatus();
  const [external, setExternal] = useState<AgentKind>('claude');
  return (
    <>
      <p className="setup__text">{t('onboarding.externalText')}</p>
      <AgentSetup mcp={mcp} agent={external} onAgent={setExternal} showPath={false} />
      <section className="setup__step">
        <h3 className="setup__step-title">{t('onboarding.externalAskTitle')}</h3>
        <p className="setup__text">{t('onboarding.externalAskText')}</p>
        <ul className="onboarding__examples">
          {EXAMPLES.map((key) => (
            <li key={key}>
              <code className="connect__code">
                {t('onboarding.externalPrefix')} {t(key)}
              </code>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
