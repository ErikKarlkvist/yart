import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import {
  findingLocation,
  type ReviewFinding,
  sortFindings,
  worstSeverity,
} from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { type SavedFlowAnalysis, type SavedReviewAnalysis } from '../../model/analysis';
import './document.css';

interface Props {
  analysis: SavedReviewAnalysis;
  flows: readonly SavedFlowAnalysis[];
  onOpenFlow: (id: string) => void;
  /** Öppnar flödet och fokuserar fyndet i grafen och Review-fliken */
  onOpenFinding: (flowAnalysisId: string, findingId: string) => void;
}

/** Reviewdokumentet: vad ändringen gör, flödena den rör och fynden per flöde. */
export function ReviewView({ analysis, flows, onOpenFlow, onOpenFinding }: Props): JSX.Element {
  const { review } = analysis;
  const severity = worstSeverity(review.findings);
  const general = review.findings.filter((f) => f.flow === undefined);

  return (
    <article className="document-view">
      <header className="document-view__header">
        <span className="analyses__tag">{t('analyses.review')}</span>{' '}
        <span className="document-view__compare">
          {t('review.compare', { base: review.baseLabel, head: review.headLabel })}
        </span>
        <h2 className="document-view__title">{review.title}</h2>
        <p className="document-view__summary">{review.summary}</p>
        <p className={`document-view__verdict is-${severity ?? 'none'}`}>
          {severity && <Icon name={severity} size="sm" />}{' '}
          {t('review.findings', { count: review.findings.length })}
        </p>
      </header>
      <div className="document-view__content">
        {review.content
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
      {review.flows.length > 0 && (
        <section className="document-view__flows">
          <h3>{t('review.flowsHeading')}</h3>
          <ul>
            {review.flows.map((name) => {
              const flow = flows.find((item) => item.name === name);
              const findings = sortFindings(review.findings.filter((f) => f.flow === name));
              return (
                <li key={name}>
                  {flow ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenFlow(flow.id);
                      }}
                    >
                      <span>{flow.flow.title}</span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ) : (
                    <p className="document-view__missing">{t('review.missingFlow', { name })}</p>
                  )}
                  {flow && <p>{flow.flow.summary}</p>}
                  {findings.length > 0 && (
                    <ol className="document-view__findings">
                      {findings.map((finding) => (
                        <FindingRow
                          key={finding.id}
                          finding={finding}
                          location={findingLocation(finding, flow?.flow, flow?.compare?.base)}
                          onOpen={
                            flow
                              ? () => {
                                  onOpenFinding(flow.id, finding.id);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {general.length > 0 && (
        <section className="document-view__flows">
          <h3>{t('review.generalHeading')}</h3>
          <ol className="document-view__findings">
            {sortFindings(general).map((finding) => (
              <FindingRow key={finding.id} finding={finding} location={null} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

interface FindingRowProps {
  finding: ReviewFinding;
  location: string | null;
  onOpen?: (() => void) | undefined;
}

function FindingRow({ finding, location, onOpen }: FindingRowProps): JSX.Element {
  const head = (
    <>
      <span className={`review__severity is-${finding.severity}`}>
        <Icon name={finding.severity} size="sm" />
      </span>
      <span className="document-view__finding-title">{finding.title}</span>
      {location && <span className="document-view__finding-where">{location}</span>}
    </>
  );
  return (
    <li className={`document-view__finding is-${finding.severity}`}>
      {onOpen ? (
        <button type="button" className="document-view__finding-open" onClick={onOpen}>
          {head}
        </button>
      ) : (
        <span className="document-view__finding-open">{head}</span>
      )}
      <p className="document-view__finding-text">{finding.description}</p>
      {finding.suggestion && (
        <p className="document-view__finding-text">
          <strong>{t('review.suggestion')}</strong> {finding.suggestion}
        </p>
      )}
    </li>
  );
}
