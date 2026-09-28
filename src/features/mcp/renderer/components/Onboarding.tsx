import { type JSX, useEffect } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useAgentCheck } from '@/features/agent';
import { useSetup } from '../SetupContext';
import { useMcpStatus } from '../useMcpStatus';
import { AgentSetup } from './AgentSetup';
import { CommandCopy } from './CommandCopy';
import './connect.css';
import './onboarding.css';

const EXAMPLES = ['onboarding.example1', 'onboarding.example2', 'onboarding.example3'] as const;

/**
 * Förstagångsguiden: vad appen är, att Claude Code måste finnas och vara
 * inloggad eftersom appen kör den i bakgrunden, och hur man ber om en
 * analys. Att koppla en egen agent utifrån är ett hopfällt alternativ.
 * Ligger över hela appen tills den stängts, och öppnas igen från sidfoten.
 */
export function Onboarding(): JSX.Element | null {
  const { guideOpen, dismissGuide } = useSetup();
  const mcp = useMcpStatus();
  const { check, refresh } = useAgentCheck();

  useEffect(() => {
    if (!guideOpen) return;
    refresh();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismissGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [guideOpen, dismissGuide, refresh]);

  if (!guideOpen) return null;

  const ready = check?.installed === true && check.loggedIn;

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

        <section className="setup__step">
          <h3 className="setup__step-title">{t('onboarding.claudeTitle')}</h3>
          <p className="setup__text">{t('onboarding.claudeText')}</p>
          <div className="connect__command">
            <span className={`onboarding__check${ready ? ' is-ok' : check ? ' is-bad' : ''}`}>
              {check === null ? (
                t('onboarding.checking')
              ) : !check.installed ? (
                <>
                  <Icon name="error" size="sm" /> {t('onboarding.notInstalled')}
                </>
              ) : !check.loggedIn ? (
                <>
                  <Icon name="warning" size="sm" />{' '}
                  {t('onboarding.notLoggedIn', { version: check.version ?? '' })}
                </>
              ) : (
                <>
                  <Icon name="info" size="sm" />{' '}
                  {t('onboarding.ready', { version: check.version ?? '' })}
                </>
              )}
            </span>
            <button type="button" className="text-button" onClick={refresh}>
              {t('onboarding.recheck')}
            </button>
          </div>
          {check && !check.installed && (
            <>
              <p className="setup__text">{t('onboarding.installHint')}</p>
              <CommandCopy command="brew install --cask claude-code" />
            </>
          )}
          {check?.installed && !check.loggedIn && (
            <>
              <p className="setup__text">{t('onboarding.loginHint')}</p>
              <CommandCopy command="claude auth login" />
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

        <details className="onboarding__external">
          <summary className="onboarding__summary">{t('onboarding.externalTitle')}</summary>
          <p className="setup__text">{t('onboarding.externalText')}</p>
          <AgentSetup mcp={mcp} showPath={false} />
        </details>

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
