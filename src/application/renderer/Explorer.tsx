import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { AnalysisList } from '@/features/analysis';
import { useRepo } from '@/features/repo';

/** Analyserna i valt repo. Repot väljs i fönsterradens meny. */
export function Explorer(): JSX.Element {
  const { repo, error, clearError } = useRepo();
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
      {repo ? <AnalysisList /> : <p className="shell__empty">{t('app.chooseRepo')}</p>}
    </div>
  );
}
