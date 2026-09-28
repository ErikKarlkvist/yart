import { type JSX } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { type McpState } from '../useMcpStatus';
import { AgentSetup } from './AgentSetup';
import './connect.css';

/**
 * Anslut-panelen: vald agent med kopplingen och guiden för den, antalet
 * anslutna sessioner och de senaste verktygsanropen.
 */
export function ConnectPanel({ mcp }: { mcp: McpState }): JSX.Element {
  const { status } = mcp;

  return (
    <div className="connect">
      <section className="connect__section">
        <h3 className="connect__heading">{t('connect.serverHeading')}</h3>
        <p className="connect__text">{t('connect.serverText')}</p>
        <AgentSetup mcp={mcp} showPath />
        {status?.url && (
          <p className="connect__muted">{t('connect.sessions', { count: status.sessions })}</p>
        )}
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
