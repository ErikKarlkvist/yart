import { type JSX, useCallback, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import {
  findingLocation,
  formatFindings,
  type ReviewFinding,
  sortFindings,
} from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { reviewFor, type SavedFlowAnalysis, useAnalyses } from '@/features/analysis';
import { FindingDetails } from '@/features/flow-graph';

/** Fynden i en review grupperade per flöde. Utan flöde hamnar de sist. */
interface FindingGroup {
  key: string;
  title: string;
  flow: SavedFlowAnalysis | null;
  findings: ReviewFinding[];
}

/**
 * Full review i högerpanelen: den valda reviewn, eller reviewn som pekar på
 * det valda flödet, med fynden per flöde. Markerade fynd kan kopieras som
 * text att klistra in hos agenten, över alla flöden på en gång.
 */
interface Props {
  /** Öppnar fyndet i flödets Review-flik och spolar dit i grafen */
  onFocus: (analysisId: string, findingId: string) => void;
}

export function ReviewSidebar({ onFocus }: Props): JSX.Element {
  const { analyses, current, select } = useAnalyses();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const review = reviewFor(analyses, current);
  const groups = review ? groupFindings(review.review, analyses) : [];
  const key = (finding: ReviewFinding): string => `${review?.id ?? ''}:${finding.id}`;
  const allKeys = groups.flatMap((g) => g.findings.map(key));
  const chosenCount = allKeys.filter((k) => selected.has(k)).length;

  const toggle = useCallback((k: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);

  if (!review)
    return (
      <p className="shell__empty shell__empty--padded">
        {analyses.some((a) => a.kind === 'review') ? t('side.pickReview') : t('side.empty')}
      </p>
    );

  /** Markerade fynd som text, med en rubrik per flöde och namnet det är sparat under. */
  const text = (): string =>
    groups
      .flatMap((group) => {
        const chosen = group.findings.filter((f) => selected.has(key(f)));
        if (chosen.length === 0) return [];
        const heading = group.flow ? `## ${group.title} (${group.flow.name})` : `## ${group.title}`;
        const location = (finding: ReviewFinding): string | null =>
          findingLocation(finding, group.flow?.flow, group.flow?.compare?.base);
        return [`${heading}\n${formatFindings(chosen, location)}`];
      })
      .join('\n\n');

  const copy = (): void => {
    void navigator.clipboard.writeText(text()).then(() => {
      setCopied(true);
    });
  };

  return (
    <div className="review-side">
      <div className="review-side__tools">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setSelected(new Set(allKeys));
          }}
        >
          {t('side.selectAll')}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={chosenCount === 0}
          onClick={() => {
            setSelected(new Set());
          }}
        >
          {t('side.clear')}
        </button>
      </div>
      <div className="review-side__scroll">
        <section className="review-side__group">
          <h3 className="review-side__compare">
            <button
              type="button"
              className={`review-side__flow-title${review.id === current?.id ? ' is-current' : ''}`}
              onClick={() => {
                select(review.id);
              }}
            >
              {review.review.title}
            </button>
            {t('review.compare', { base: review.review.baseLabel, head: review.review.headLabel })}
          </h3>
          {groups.map((group) => {
            const isCurrent = group.flow !== null && group.flow.id === current?.id;
            return (
              <div key={group.key} className="review-side__flow">
                <button
                  type="button"
                  className={`review-side__flow-title${isCurrent ? ' is-current' : ''}`}
                  title={group.flow?.flow.question}
                  disabled={group.flow === null}
                  onClick={() => {
                    if (group.flow) select(group.flow.id);
                  }}
                >
                  {group.title}
                  <span className="count-badge">{group.findings.length}</span>
                </button>
                <ul className="review-side__list">
                  {group.findings.map((finding) => {
                    const k = key(finding);
                    const checked = selected.has(k);
                    const expanded = open === k;
                    return (
                      <li
                        key={finding.id}
                        className={`review-side__item is-${finding.severity}${checked ? ' is-checked' : ''}`}
                      >
                        <div className="review-side__row">
                          <input
                            type="checkbox"
                            checked={checked}
                            aria-label={finding.title}
                            onChange={() => {
                              toggle(k);
                            }}
                          />
                          <button
                            type="button"
                            className="review-side__open"
                            title={t('side.openHint')}
                            disabled={group.flow === null}
                            onClick={() => {
                              if (group.flow) onFocus(group.flow.id, finding.id);
                            }}
                          >
                            <span className={`review__severity is-${finding.severity}`}>
                              <Icon name={finding.severity} size="sm" />
                            </span>
                            <span className="review-side__text">{finding.title}</span>
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--quiet"
                            aria-expanded={expanded}
                            aria-label={finding.title}
                            onClick={() => {
                              setOpen(expanded ? null : k);
                            }}
                          >
                            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size="sm" />
                          </button>
                        </div>
                        {expanded && (
                          <div className="review-side__body">
                            <FindingDetails finding={finding} showSource={false} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
      <div className="review-side__actions">
        <button type="button" disabled={chosenCount === 0} onClick={copy}>
          <Icon name="copy" size="sm" /> {copied ? t('side.copied') : t('side.copy')}
          {chosenCount > 0 && !copied && ` (${chosenCount})`}
        </button>
      </div>
    </div>
  );
}

function groupFindings(
  review: { flows: string[]; findings: ReviewFinding[] },
  analyses: readonly ReturnType<typeof useAnalyses>['analyses'][number][],
): FindingGroup[] {
  const groups: FindingGroup[] = review.flows.map((name) => {
    const flow =
      analyses.find((a): a is SavedFlowAnalysis => a.kind === 'flow' && a.name === name) ?? null;
    return {
      key: name,
      title: flow?.flow.title ?? name,
      flow,
      findings: sortFindings(review.findings.filter((f) => f.flow === name)),
    };
  });
  const general = sortFindings(review.findings.filter((f) => f.flow === undefined));
  if (general.length > 0)
    groups.push({ key: '', title: t('review.generalHeading'), flow: null, findings: general });
  return groups.filter((g) => g.findings.length > 0 || g.flow !== null);
}
