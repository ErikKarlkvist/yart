import { type JSX } from 'react';
import { formatTime, t } from '@/common/model/i18n';
import { useAnalyses } from '../AnalysisContext';
import './analysis.css';

/** Loggen över analyser agenter levererat eller fått avvisade. */
export function DeliveryLog(): JSX.Element {
  const { deliveries } = useAnalyses();
  if (deliveries.length === 0) return <p className="shell__empty">{t('log.idle')}</p>;

  return (
    <ol className="delivery">
      {deliveries.map((entry) => (
        <li key={entry.at} className={`delivery__entry delivery__entry--${entry.type}`}>
          <span className="delivery__time">{formatTime(entry.at)}</span>
          <div className="delivery__body">
            {entry.type === 'imported' ? (
              t('log.imported', { title: entry.title, source: entry.source })
            ) : (
              <>
                {t('log.rejected', { source: entry.source })}
                <ul className="delivery__errors">
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
