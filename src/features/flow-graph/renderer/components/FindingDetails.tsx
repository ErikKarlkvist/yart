import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type ReviewFinding } from '@/common/model/review';
import { SourceView } from '@/features/repo';

interface Props {
  finding: ReviewFinding;
  /** Commiten koden läses ur när den inte är utcheckad */
  commit?: string | undefined;
}

/** Ett utfällt fynd i panelen Review: beskrivning, förslag och koden det gäller. */
export function FindingDetails({ finding, commit }: Props): JSX.Element {
  return (
    <div className="finding-details">
      <p className="finding-details__text">{finding.description}</p>
      {finding.suggestion && (
        <p className="finding-details__text">
          <strong>{t('review.suggestion')}</strong> {finding.suggestion}
        </p>
      )}
      {finding.source && <SourceView source={finding.source} commit={commit} />}
    </div>
  );
}
