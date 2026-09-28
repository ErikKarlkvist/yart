import { type JSX, useEffect } from 'react';
import { t } from '@/common/model/i18n';
import { useSetup } from '../SetupContext';
import { useMcpStatus } from '../useMcpStatus';
import { AgentSetup } from './AgentSetup';
import './connect.css';
import './onboarding.css';

const EXAMPLES = ['onboarding.example1', 'onboarding.example2', 'onboarding.example3'] as const;

/**
 * Förstagångsguiden: vad appen är, vilken agent man har, hur den kopplas och
 * hur man ber om en analys. Ligger över hela appen tills den stängts, och kan
 * öppnas igen från Anslut-panelen.
 */
export function Onboarding(): JSX.Element | null {
  const { guideOpen, dismissGuide } = useSetup();
  const mcp = useMcpStatus();

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
        <p className="setup__text">{t('setup.chooseAgent')}</p>

        <AgentSetup mcp={mcp} showPath={false} />

        <section className="setup__step">
          <h3 className="setup__step-title">{t('onboarding.step3Title')}</h3>
          <p className="setup__text">{t('onboarding.step3Text')}</p>
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
          <button type="button" className="onboarding__done" onClick={dismissGuide}>
            {t('onboarding.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
