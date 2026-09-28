import { type JSX, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { worstSeverity } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { analysisTitle, refLabel, type SavedAnalysis } from '../../model/analysis';
import { useAnalyses } from '../AnalysisContext';
import './analysis.css';

export function AnalysisList(): JSX.Element {
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
      <h2 className="analyses__heading">{t('analyses.heading')}</h2>
      {error && <p className="analyses__error">{error}</p>}
      {rejection?.type === 'rejected' && (
        <div className="analyses__error analyses__rejection">
          <div className="analyses__rejection-head">
            <span>{t('inbox.rejected', { source: rejection.source })}</span>
            <button
              type="button"
              className="icon-button icon-button--quiet"
              title={t('inbox.dismiss')}
              aria-label={t('inbox.dismiss')}
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
          <p className="analyses__rejection-hint">{t('inbox.errorsWritten')}</p>
        </div>
      )}
      {analyses.length === 0 && !error && <p className="analyses__muted">{t('analyses.empty')}</p>}
      {groupAnalyses(analyses).map((group) => (
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
              <span className="analyses__group-label">{group.label}</span>
              <span className="count-badge">{group.items.length}</span>
            </button>
          </h3>
          {!collapsed.has(group.key) && (
            <ul className="analyses__list">
              {group.items.map((analysis) => {
                const active = analysis.id === current?.id;
                const title = analysisTitle(analysis);
                const description =
                  analysis.kind === 'document'
                    ? analysis.document.summary
                    : analysis.review
                      ? t('review.compare', {
                          base: analysis.review.baseLabel,
                          head: analysis.review.headLabel,
                        })
                      : analysis.origin === 'builtin'
                        ? t('analyses.builtin')
                        : formatDate(analysis.createdAt);
                return (
                  <li key={analysis.id} className={`analyses__item${active ? ' is-active' : ''}`}>
                    <button
                      type="button"
                      className="analyses__open"
                      title={
                        analysis.kind === 'document'
                          ? analysis.document.summary
                          : analysis.flow.question
                      }
                      onClick={() => {
                        select(active ? null : analysis.id);
                      }}
                    >
                      <span className="analyses__title">
                        <span className="analyses__tag">
                          {t(analysis.kind === 'document' ? 'analyses.document' : 'analyses.flow')}
                        </span>
                        {analysis.kind === 'flow' && analysis.review && (
                          <span
                            className={`analyses__tag is-${worstSeverity(analysis.review.findings) ?? 'none'}`}
                          >
                            <Icon name="warning" size="sm" /> {t('analyses.review')}
                          </span>
                        )}
                        <span className="analyses__title-text">{title}</span>
                      </span>
                      <span className="analyses__meta">
                        {description}
                        {analysis.kind === 'flow'
                          ? ` · ${t('analyses.steps', { count: analysis.flow.steps.length })}`
                          : ` · ${t('analyses.linkedFlows', { count: analysis.document.flows.length })}`}
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
  title: string;
  items: SavedAnalysis[];
}

/**
 * Grupperar på branch och commit, eftersom ett flöde bara gäller en version
 * av koden. Inbyggda först, sedan grupperna i ordning efter nyaste analys,
 * sist sådant utan git.
 */
function groupAnalyses(analyses: readonly SavedAnalysis[]): Group[] {
  const groups = new Map<string, Group>();
  for (const analysis of analyses) {
    const key = analysis.origin === 'builtin' ? 'builtin' : (analysis.ref?.commit ?? 'worktree');
    const group = groups.get(key) ?? {
      key,
      label:
        analysis.origin === 'builtin'
          ? t('analyses.builtin')
          : analysis.ref
            ? refLabel(analysis.ref)
            : t('analyses.workingTree'),
      title: analysis.ref?.commit ?? '',
      items: [],
    };
    group.items.push(analysis);
    groups.set(key, group);
  }
  const order = (g: Group): number => (g.key === 'builtin' ? 0 : g.key === 'worktree' ? 2 : 1);
  return [...groups.values()].sort((a, b) => order(a) - order(b));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
}
