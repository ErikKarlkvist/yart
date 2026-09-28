import { type JSX } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { claudeMcpAddCommand, type McpStatus } from '../../model/mcp';
import { useOnboarding } from '../OnboardingContext';
import { CommandCopy } from './CommandCopy';
import { SkillInstall } from './SkillInstall';
import './connect.css';

interface Props {
  status: McpStatus | null;
  onInstallSkill: () => Promise<void>;
}

/**
 * Anslut-panelen: adressen agenter kopplar till, kommandot för Claude Code,
 * skillen att installera och de senaste verktygsanropen.
 */
export function ConnectPanel({ status, onInstallSkill }: Props): JSX.Element {
  const onboarding = useOnboarding();

  return (
    <div className="connect">
      <section className="connect__section">
        <h3 className="connect__heading">{t('connect.serverHeading')}</h3>
        {status?.url ? (
          <>
            <p className="connect__text">{t('connect.serverText')}</p>
            <code className="connect__code">{status.url}</code>
            <p className="connect__text">{t('connect.claudeText')}</p>
            <CommandCopy command={claudeMcpAddCommand(status.url)} />
            <p className="connect__muted">{t('connect.sessions', { count: status.sessions })}</p>
          </>
        ) : status?.error ? (
          <p className="connect__error">{t('app.mcpFailed', { error: status.error })}</p>
        ) : (
          <p className="connect__muted">{t('app.mcpStarting')}</p>
        )}
      </section>

      <section className="connect__section">
        <h3 className="connect__heading">{t('connect.skillHeading')}</h3>
        <p className="connect__text">{t('connect.skillText')}</p>
        {status && <SkillInstall status={status} onInstall={onInstallSkill} showPath />}
      </section>

      <section className="connect__section connect__section--grow">
        <h3 className="connect__heading">{t('connect.activityHeading')}</h3>
        {!status || status.activity.length === 0 ? (
          <p className="connect__muted">{t('connect.activityEmpty')}</p>
        ) : (
          <ol className="connect__activity">
            {status.activity.map((entry) => (
              <li
                key={`${entry.at}:${entry.tool}`}
                className={`connect__entry${entry.ok ? '' : ' connect__entry--failed'}`}
              >
                <span className="connect__time">
                  {new Date(entry.at).toLocaleTimeString(LOCALE, { timeStyle: 'medium' })}
                </span>
                <div className="connect__entry-body">
                  <span className="connect__entry-head">
                    {entry.client} · {entry.tool}
                  </span>
                  <span className="connect__entry-summary">{entry.summary}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="connect__section">
        <button type="button" className="text-button" onClick={onboarding.show}>
          {t('connect.showGuide')}
        </button>
      </section>
    </div>
  );
}
