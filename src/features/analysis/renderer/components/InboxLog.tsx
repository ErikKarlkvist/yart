import { type JSX } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { useAnalyses } from '../AnalysisContext';
import './analysis.css';

/** Loggen över analyser som levererats eller avvisats, över MCP eller från `.reverik/`. */
export function InboxLog(): JSX.Element {
  const { inbox } = useAnalyses();
  if (inbox.length === 0) return <p className="shell__empty">{t('inbox.idle')}</p>;

  return (
    <ol className="inbox">
      {inbox.map((entry) => (
        <li key={entry.at} className={`inbox__entry inbox__entry--${entry.type}`}>
          <span className="inbox__time">
            {new Date(entry.at).toLocaleTimeString(LOCALE, { timeStyle: 'medium' })}
          </span>
          <div className="inbox__body">
            {entry.type === 'imported' ? (
              t('inbox.imported', { title: entry.title, source: entry.source })
            ) : (
              <>
                {t('inbox.rejected', { source: entry.source })}
                <ul className="inbox__errors">
                  {entry.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
