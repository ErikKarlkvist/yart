import { type JSX, useCallback, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { formatFindings, type ReviewFinding, sortFindings } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { type SavedAnalysis, type SavedFlowAnalysis, useAnalyses } from '@/features/analysis';
import { FindingDetails } from '@/features/flow-graph';
import { useTerminalApi } from '@/features/terminal';

interface ReviewGroup {
  key: string;
  base: string;
  head: string;
  analyses: SavedFlowAnalysis[];
}

/**
 * Full review i högerpanelen: alla flöden i den review som den valda analysen
 * hör till, alltså samma jämförelse base → head, med fynden per flöde.
 * Markerade fynd kan kopieras som text eller skickas till agenten, över alla
 * flöden på en gång.
 */
interface Props {
  /** Öppnar fyndet i analysens Review-flik och spolar dit i grafen */
  onFocus: (analysisId: string, findingId: string) => void;
}

export function ReviewSidebar({ onFocus }: Props): JSX.Element {
  const { analyses, current, select } = useAnalyses();
  const terminal = useTerminalApi();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Instruktionen till agenten, fältet visas när man tryckt på Send
  const [instruction, setInstruction] = useState<string | null>(null);

  const groups = groupReviews(analyses, current);
  const key = (analysis: SavedAnalysis, finding: ReviewFinding): string =>
    `${analysis.id}:${finding.id}`;
  const allKeys = groups.flatMap((g) =>
    g.analyses.flatMap((a) => (a.review?.findings ?? []).map((f) => key(a, f))),
  );
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

  if (groups.length === 0)
    return (
      <p className="shell__empty shell__empty--padded">
        {analyses.some((a) => a.kind === 'flow' && a.review)
          ? t('side.pickReview')
          : t('side.empty')}
      </p>
    );

  /** Markerade fynd som text, med en rubrik per flöde och reviewfilen den hör till. */
  const text = (): string =>
    groups
      .flatMap((group) =>
        group.analyses.flatMap((analysis) => {
          const review = analysis.review;
          if (!review) return [];
          const chosen = review.findings.filter((f) => selected.has(key(analysis, f)));
          if (chosen.length === 0) return [];
          const heading = `## ${analysis.flow.title} (${analysis.name})`;
          return [`${heading}\n${formatFindings(chosen, analysis.flow, review.base)}`];
        }),
      )
      .join('\n\n');

  const copy = (): void => {
    void navigator.clipboard.writeText(text()).then(() => {
      setCopied(true);
    });
  };
  const send = (): void => {
    const first = groups[0];
    if (!first || instruction === null) return;
    terminal.send(
      t('side.prompt', {
        base: first.base,
        head: first.head,
        findings: text(),
        instruction: instruction.trim() || t('side.defaultInstruction'),
      }),
    );
    setInstruction(null);
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
        {groups.map((group) => (
          <section key={group.key} className="review-side__group">
            <h3 className="review-side__compare">
              {t('review.compare', { base: group.base, head: group.head })}
            </h3>
            {group.analyses.map((analysis) => {
              const review = analysis.review;
              if (!review) return null;
              const isCurrent = analysis.id === current?.id;
              return (
                <div key={analysis.id} className="review-side__flow">
                  <button
                    type="button"
                    className={`review-side__flow-title${isCurrent ? ' is-current' : ''}`}
                    title={analysis.flow.question}
                    onClick={() => {
                      select(analysis.id);
                    }}
                  >
                    {analysis.flow.title}
                    <span className="count-badge">{review.findings.length}</span>
                  </button>
                  <ul className="review-side__list">
                    {sortFindings(review.findings).map((finding) => {
                      const k = key(analysis, finding);
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
                              onClick={() => {
                                onFocus(analysis.id, finding.id);
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
        ))}
      </div>
      {instruction !== null && (
        <div className="review-side__compose">
          <textarea
            className="review-side__instruction"
            autoFocus
            rows={3}
            value={instruction}
            placeholder={t('side.defaultInstruction')}
            onChange={(event) => {
              setInstruction(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
              else if (event.key === 'Escape') setInstruction(null);
            }}
          />
          <div className="review-side__compose-actions">
            <span className="review-side__hint">
              {t('side.composeHint', { count: chosenCount })}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setInstruction(null);
              }}
            >
              {t('ask.cancel')}
            </button>
            <button type="button" className="review-side__send" onClick={send}>
              <Icon name="chat" size="sm" /> {t('side.sendNow')}
            </button>
          </div>
        </div>
      )}
      <div className="review-side__actions">
        <button type="button" disabled={chosenCount === 0} onClick={copy}>
          <Icon name="copy" size="sm" /> {copied ? t('side.copied') : t('side.copy')}
          {chosenCount > 0 && !copied && ` (${chosenCount})`}
        </button>
        <button
          type="button"
          className="review-side__send"
          disabled={chosenCount === 0 || instruction !== null}
          title={t('side.sendHint')}
          onClick={() => {
            setInstruction('');
          }}
        >
          <Icon name="chat" size="sm" /> {t('side.send')}
          {chosenCount > 0 && ` (${chosenCount})`}
        </button>
      </div>
    </div>
  );
}

/** Den valda analysens review: alla analyser med samma jämförelse base → head. Tom utan vald review. */
function groupReviews(
  analyses: readonly SavedAnalysis[],
  current: SavedAnalysis | null,
): ReviewGroup[] {
  const review = current?.kind === 'flow' ? current.review : undefined;
  if (!review) return [];
  const members = analyses.filter(
    (a): a is SavedFlowAnalysis =>
      a.kind === 'flow' &&
      a.review?.baseLabel === review.baseLabel &&
      a.review.headLabel === review.headLabel,
  );
  return [
    {
      key: `${review.baseLabel}\u0000${review.headLabel}`,
      base: review.baseLabel,
      head: review.headLabel,
      analyses: members,
    },
  ];
}
