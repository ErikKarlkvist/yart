import { type JSX, useEffect, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { claudeMcpAddCommand, type McpStatus } from '../../model/mcp';
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
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const command = status?.url ? claudeMcpAddCommand(status.url) : null;

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);

  const copy = (): void => {
    if (!command) return;
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
    });
  };
  const install = (): void => {
    setInstalling(true);
    onInstallSkill()
      .catch(console.error)
      .finally(() => {
        setInstalling(false);
      });
  };

  return (
    <div className="connect">
      <section className="connect__section">
        <h3 className="connect__heading">{t('connect.serverHeading')}</h3>
        {status?.url ? (
          <>
            <p className="connect__text">{t('connect.serverText')}</p>
            <code className="connect__code">{status.url}</code>
            <p className="connect__text">{t('connect.claudeText')}</p>
            <div className="connect__command">
              <code className="connect__code">{command}</code>
              <button type="button" className="text-button" onClick={copy}>
                <Icon name="copy" size="sm" /> {copied ? t('side.copied') : t('side.copy')}
              </button>
            </div>
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
        {status && (
          <div className="connect__command">
            <span className={`connect__skill is-${status.skill.state}`}>
              {t(`connect.skill.${status.skill.state}`)}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={installing || status.skill.state === 'current'}
              onClick={install}
            >
              {status.skill.state === 'missing' ? t('connect.install') : t('connect.update')}
            </button>
          </div>
        )}
        {status && <code className="connect__code connect__code--muted">{status.skill.path}</code>}
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
    </div>
  );
}
