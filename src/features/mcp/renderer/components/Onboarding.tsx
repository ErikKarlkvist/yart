import { type JSX, useEffect } from 'react';
import { t } from '@/common/model/i18n';
import { claudeMcpAddCommand } from '../../model/mcp';
import { useOnboarding } from '../OnboardingContext';
import { useMcpStatus } from '../useMcpStatus';
import { CommandCopy } from './CommandCopy';
import { SkillInstall } from './SkillInstall';
import './connect.css';
import './onboarding.css';

const EXAMPLES = ['onboarding.example1', 'onboarding.example2', 'onboarding.example3'] as const;

/**
 * Förstagångsguiden: vad appen är, hur agenten kopplas och hur man ber om
 * en analys. Ligger över hela appen tills den stängts, och kan öppnas igen
 * från Anslut-panelen.
 */
export function Onboarding(): JSX.Element | null {
  const { open, dismiss } = useOnboarding();
  const { status, installSkill } = useMcpStatus();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, dismiss]);

  if (!open) return null;

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

        <section className="onboarding__step">
          <h3 className="onboarding__step-title">{t('onboarding.step1Title')}</h3>
          <p className="onboarding__text">{t('onboarding.step1Text')}</p>
          {status?.url ? (
            <CommandCopy command={claudeMcpAddCommand(status.url)} />
          ) : (
            <p className="connect__muted">
              {status?.error ? t('app.mcpFailed', { error: status.error }) : t('app.mcpStarting')}
            </p>
          )}
        </section>

        <section className="onboarding__step">
          <h3 className="onboarding__step-title">{t('onboarding.step2Title')}</h3>
          <p className="onboarding__text">{t('onboarding.step2Text')}</p>
          {status && <SkillInstall status={status} onInstall={installSkill} showPath={false} />}
        </section>

        <section className="onboarding__step">
          <h3 className="onboarding__step-title">{t('onboarding.step3Title')}</h3>
          <p className="onboarding__text">{t('onboarding.step3Text')}</p>
          <ul className="onboarding__examples">
            {EXAMPLES.map((key) => (
              <li key={key}>
                <code className="connect__code">{t(key)}</code>
              </li>
            ))}
          </ul>
        </section>

        <p className="onboarding__outro">{t('onboarding.outro')}</p>
        <div className="onboarding__actions">
          <button type="button" className="onboarding__done" onClick={dismiss}>
            {t('onboarding.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
