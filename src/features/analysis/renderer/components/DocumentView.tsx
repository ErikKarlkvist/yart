import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type SavedDocumentAnalysis, type SavedFlowAnalysis } from '../../model/analysis';
import './document.css';

interface Props {
  analysis: SavedDocumentAnalysis;
  flows: readonly SavedFlowAnalysis[];
  onOpenFlow: (id: string) => void;
}

/** Textuell repoöversikt med genvägar till flöden som beskriver detaljerna. */
export function DocumentView({ analysis, flows, onOpenFlow }: Props): JSX.Element {
  const related = analysis.document.flows.flatMap((name) => {
    const flow = flows.find((item) => item.name === name);
    return flow ? [flow] : [];
  });

  return (
    <article className="document-view">
      <header className="document-view__header">
        <span className="analyses__tag">{t('analyses.document')}</span>
        <h2 className="document-view__title">{analysis.document.title}</h2>
        <p className="document-view__summary">{analysis.document.summary}</p>
      </header>
      <div className="document-view__content">
        {analysis.document.content
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
      {related.length > 0 && (
        <section className="document-view__flows">
          <h3>{t('document.relatedFlows')}</h3>
          <ul>
            {related.map((flow) => (
              <li key={flow.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenFlow(flow.id);
                  }}
                >
                  <span>{flow.flow.title}</span>
                  <span aria-hidden="true">›</span>
                </button>
                <p>{flow.flow.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
