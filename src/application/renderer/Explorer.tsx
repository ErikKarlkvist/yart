import { type JSX, useCallback } from 'react';
import { t } from '@/common/model/i18n';
import { useAgent } from '@/features/agent';
import { AnalysisList } from '@/features/analysis';
import { useRepo } from '@/features/repo';

/** Analyserna i valt repo, grupperade på konversationen som skapade dem. */
export function Explorer(): JSX.Element {
  const { repo, error, clearError } = useRepo();
  const { conversations } = useAgent();
  // Utan namn från agenten ännu räcker den första frågan, som konversationen annars heter
  const conversationTitle = useCallback(
    (id: string) => {
      const title = conversations.find((item) => item.id === id)?.title;
      return title === undefined || title === '' ? null : title;
    },
    [conversations],
  );
  return (
    <div className="explorer">
      {error && (
        <button
          type="button"
          className="explorer__error"
          title={t('repo.dismissError')}
          onClick={clearError}
        >
          {error}
        </button>
      )}
      {repo ? (
        <AnalysisList conversationTitle={conversationTitle} />
      ) : (
        <p className="shell__empty">{t('app.chooseRepo')}</p>
      )}
    </div>
  );
}
