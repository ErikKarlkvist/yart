import { type JSX, useEffect, useState } from 'react';
import { BrandMark } from '@/common/renderer/BrandMark';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { type AgentKind, type RunnableAgent } from '@/common/model/agent';
import { useAgentCheck } from '@/features/agent';
import { useSetup } from '../SetupContext';
import { useMcpStatus } from '../useMcpStatus';
import { AgentSetup } from './AgentSetup';
import { CommandCopy } from './CommandCopy';
import './connect.css';
import './onboarding.css';

const RUNNABLE: readonly RunnableAgent[] = ['claude', 'codex'];
const STEPS = ['builtin', 'external'] as const;
type Step = (typeof STEPS)[number];

const INSTALL_COMMANDS: Readonly<Record<RunnableAgent, string>> = {
  claude: 'brew install --cask claude-code',
  codex: 'npm install -g @openai/codex',
};
const LOGIN_COMMANDS: Readonly<Record<RunnableAgent, string>> = {
  claude: 'claude auth login',
  codex: 'codex login',
};

/**
 * Förstagångsguiden i två steg. Först väljs Claude Code eller Codex som
 * appen kör i bakgrunden, eller Skip för ingen. Sedan hur en extern AI
 * kopplas via MCP. Valet i första steget är det appen sedan använder.
 * Ligger över hela appen tills den stängts, och öppnas igen från sidfoten.
 */
export function Onboarding(): JSX.Element | null {
  const { guideOpen } = useSetup();
  // Monteras om vid varje öppning, så guiden börjar om från första steget
  return guideOpen ? <OnboardingCard /> : null;
}

function OnboardingCard(): JSX.Element {
  const { dismissGuide, agent, setAgent } = useSetup();
  const [step, setStep] = useState<Step>('builtin');

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismissGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [dismissGuide]);

  return (
    <div className="onboarding" role="presentation">
      <div
        className="onboarding__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="onboarding__head">
          <BrandMark size="lg" />
          <ol className="onboarding__steps">
            {STEPS.map((key, index) => (
              <li key={key}>
                <button
                  type="button"
                  className={`onboarding__step${step === key ? ' is-active' : ''}`}
                  aria-current={step === key ? 'step' : undefined}
                  onClick={() => {
                    setStep(key);
                  }}
                >
                  {index + 1}. {t(`onboarding.step.${key}`)}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {step === 'builtin' ? (
          <>
            <h2 id="onboarding-title" className="onboarding__title">
              {t('onboarding.builtinTitle')}
            </h2>
            <p className="onboarding__lead">{t('onboarding.builtinText')}</p>
            <div className="agent-picker agent-picker--wide" role="radiogroup">
              {[...RUNNABLE, 'manual' as const].map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={agent === kind}
                  className={`agent-picker__option${agent === kind ? ' is-active' : ''}`}
                  onClick={() => {
                    setAgent(kind);
                  }}
                >
                  {t(`onboarding.path.${kind}`)}
                </button>
              ))}
            </div>
            {agent === 'manual' ? (
              <p className="onboarding__lead">{t('onboarding.skipText')}</p>
            ) : (
              <AgentCheck agent={agent} />
            )}
          </>
        ) : (
          <>
            <h2 id="onboarding-title" className="onboarding__title">
              {t('onboarding.externalTitle')}
            </h2>
            <p className="onboarding__lead">{t('onboarding.externalText')}</p>
            <ExternalSetup initial={agent} />
          </>
        )}

        <div className="onboarding__actions">
          {step === 'builtin' ? (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAgent('manual');
                  setStep('external');
                }}
              >
                {t('onboarding.skip')}
              </button>
              <button
                type="button"
                className="onboarding__done"
                onClick={() => {
                  setStep('external');
                }}
              >
                {t('onboarding.next')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStep('builtin');
                }}
              >
                {t('onboarding.back')}
              </button>
              <button type="button" className="onboarding__done" onClick={dismissGuide}>
                {t('onboarding.done')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Kontroll att agenten finns och är inloggad, med kommandot som löser det som saknas. */
function AgentCheck({ agent }: { agent: RunnableAgent }): JSX.Element {
  const { check, refresh } = useAgentCheck(agent);
  const ready = check?.installed === true && check.loggedIn;
  const name = t(`agent.${agent}`);

  return (
    <section className="setup__step">
      <div className="connect__command">
        <span className={`onboarding__check${ready ? ' is-ok' : check ? ' is-bad' : ''}`}>
          {check === null ? (
            t('onboarding.checking', { name })
          ) : !check.installed ? (
            <>
              <Icon name="error" size="sm" /> {t('onboarding.notInstalled', { name })}
            </>
          ) : check.error ? (
            <>
              <Icon name="error" size="sm" />{' '}
              {t('onboarding.checkFailed', { name, error: check.error })}
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
      {check && !check.installed && <CommandCopy command={INSTALL_COMMANDS[agent]} />}
      {check?.installed && !check.loggedIn && !check.error && (
        <CommandCopy command={LOGIN_COMMANDS[agent]} />
      )}
    </section>
  );
}

/** Extern AI: koppla den till MCP-servern och ge den guiden. */
function ExternalSetup({ initial }: { initial: AgentKind }): JSX.Element {
  const mcp = useMcpStatus();
  const [external, setExternal] = useState<AgentKind>(initial);
  return <AgentSetup mcp={mcp} agent={external} onAgent={setExternal} showPath={false} />;
}
