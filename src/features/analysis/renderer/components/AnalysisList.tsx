import { type JSX, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { worstSeverity } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { analysisTitle, refLabel, type SavedAnalysis } from '../../model/analysis';
import { useAnalyses } from '../AnalysisContext';
import './analysis.css';

interface Props {
  /** Namnet på konversationen i appen som sparade analyser, null om den inte finns */
  conversationTitle?: (conversationId: string) => string | null;
}

export function AnalysisList({ conversationTitle }: Props): JSX.Element {
  const { analyses, current, error, rejection, select, remove, dismissRejection } = useAnalyses();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section className="analyses">
      {error && <p className="analyses__error">{error}</p>}
      {rejection?.type === 'rejected' && (
        <div className="analyses__error analyses__rejection">
          <div className="analyses__rejection-head">
            <span>{t('log.rejected', { source: rejection.source })}</span>
            <button
              type="button"
              className="icon-button icon-button--quiet"
              title={t('log.dismiss')}
              aria-label={t('log.dismiss')}
              onClick={dismissRejection}
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
          <ul className="analyses__rejection-errors">
            {rejection.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="analyses__rejection-hint">{t('log.errorsReturned')}</p>
        </div>
      )}
      {analyses.length === 0 && !error && <p className="analyses__muted">{t('analyses.empty')}</p>}
      {groupAnalyses(analyses, conversationTitle).map((group) => (
        <div key={group.key} className="analyses__group">
          <h3 className="analyses__group-heading">
            <button
              type="button"
              className="analyses__group-toggle"
              aria-expanded={!collapsed.has(group.key)}
              title={group.title}
              onClick={() => {
                toggle(group.key);
              }}
            >
              <Icon name={collapsed.has(group.key) ? 'chevronRight' : 'chevronDown'} size="sm" />
              <span
                className={`analyses__group-label${group.isRef ? ' analyses__group-label--ref' : ''}`}
              >
                {group.label}
              </span>
              <span className="count-badge">{group.items.length}</span>
            </button>
          </h3>
          {!collapsed.has(group.key) && (
            <ul className="analyses__list">
              {group.items.map((analysis) => {
                const active = analysis.id === current?.id;
                const title = analysisTitle(analysis);
                const compare =
                  analysis.kind === 'review'
                    ? analysis.review
                    : analysis.kind === 'flow'
                      ? analysis.compare
                      : undefined;
                const description =
                  analysis.kind === 'document'
                    ? analysis.document.summary
                    : compare
                      ? t('review.compare', { base: compare.baseLabel, head: compare.headLabel })
                      : analysis.origin === 'builtin'
                        ? t('analyses.builtin')
                        : formatDate(analysis.createdAt);
                const meta =
                  analysis.kind === 'flow'
                    ? t('analyses.steps', { count: analysis.flow.steps.length })
                    : analysis.kind === 'document'
                      ? t('analyses.linkedFlows', { count: analysis.document.flows.length })
                      : t('analyses.findings', { count: analysis.review.findings.length });
                return (
                  <li key={analysis.id} className={`analyses__item${active ? ' is-active' : ''}`}>
                    <button
                      type="button"
                      className="analyses__open"
                      title={
                        analysis.kind === 'flow'
                          ? analysis.flow.question
                          : analysisSummary(analysis)
                      }
                      onClick={() => {
                        select(active ? null : analysis.id);
                      }}
                    >
                      <span className="analyses__title">
                        {analysis.kind === 'review' ? (
                          <span
                            className={`analyses__tag is-${worstSeverity(analysis.review.findings) ?? 'none'}`}
                          >
                            <Icon name="warning" size="sm" /> {t('analyses.review')}
                          </span>
                        ) : (
                          <span className="analyses__tag">
                            {t(
                              analysis.kind === 'document' ? 'analyses.document' : 'analyses.flow',
                            )}
                          </span>
                        )}
                        <span className="analyses__title-text">{title}</span>
                      </span>
                      <span className="analyses__meta">
                        {description} · {meta}
                      </span>
                    </button>
                    {analysis.origin !== 'builtin' && (
                      <button
                        type="button"
                        className="icon-button icon-button--quiet"
                        title={t('analyses.delete')}
                        aria-label={t('analyses.delete')}
                        onClick={() => void remove(analysis.id)}
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

interface Group {
  key: string;
  label: string;
  /** Rubriken är branch och commit, inte ett namn */
  isRef: boolean;
  title: string;
  items: SavedAnalysis[];
}

/**
 * Grupperar på konversationen som skapade analyserna, med dess namn som
 * rubrik, så det man bad om hålls ihop. Analyser utan konversation, från
 * externa agenter, grupperas på branch och commit eftersom ett flöde bara
 * gäller en version av koden. Inbyggda först, sedan grupperna i ordning
 * efter nyaste analys, sist sådant utan git.
 */
function groupAnalyses(
  analyses: readonly SavedAnalysis[],
  conversationTitle: Props['conversationTitle'],
): Group[] {
  const groups = new Map<string, Group>();
  for (const analysis of analyses) {
    const conversation =
      analysis.conversationId !== undefined
        ? (conversationTitle?.(analysis.conversationId) ?? null)
        : null;
    const key =
      analysis.origin === 'builtin'
        ? 'builtin'
        : conversation !== null
          ? `conversation:${analysis.conversationId ?? ''}`
          : (analysis.ref?.commit ?? 'worktree');
    const ref = analysis.ref ? refLabel(analysis.ref) : t('analyses.workingTree');
    const group = groups.get(key) ?? {
      key,
      label: analysis.origin === 'builtin' ? t('analyses.builtin') : (conversation ?? ref),
      isRef: analysis.origin !== 'builtin' && conversation === null,
      title: conversation !== null ? ref : (analysis.ref?.commit ?? ''),
      items: [],
    };
    group.items.push(analysis);
    groups.set(key, group);
  }
  const order = (g: Group): number => (g.key === 'builtin' ? 0 : g.key === 'worktree' ? 2 : 1);
  return [...groups.values()].sort((a, b) => order(a) - order(b));
}

function analysisSummary(analysis: SavedAnalysis): string {
  switch (analysis.kind) {
    case 'flow':
      return analysis.flow.summary;
    case 'document':
      return analysis.document.summary;
    case 'review':
      return analysis.review.summary;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
}
