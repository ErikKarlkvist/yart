import { type JSX } from 'react';
import { type Flow } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import {
  diffFlows,
  findingLocation,
  type FlowCompare,
  type ReviewFinding,
  sortFindings,
} from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { FindingDetails } from './FindingDetails';
import './graph.css';

interface Props {
  /** Flödet, efter ändringen när det finns en jämförelse */
  flow: Flow;
  compare: FlowCompare | undefined;
  /** Fynden som pekar på det här flödet */
  findings: readonly ReviewFinding[];
  /** Commiten flödet beskriver, för kodutdragen */
  commit?: string | undefined;
  focusedFindingId: string | null;
  onFocus: (findingId: string | null) => void;
}

/** Fliken Review i nedre panelen: vad som ändrats och fynden, allvarligast först. */
export function ReviewPanel({
  flow,
  compare,
  findings,
  commit,
  focusedFindingId,
  onFocus,
}: Props): JSX.Element {
  const diff = compare ? diffFlows(compare.base, flow) : null;
  const count = (change: string): number =>
    diff ? [...diff.nodes.values(), ...diff.edges.values()].filter((c) => c === change).length : 0;
  const sorted = sortFindings(findings);

  return (
    <div className="review">
      {compare && (
        <p className="review__head">
          <span className="review__compare">
            {t('review.compare', { base: compare.baseLabel, head: compare.headLabel })}
          </span>
          <span className="review__changes">
            {t('review.changes', {
              added: count('added'),
              removed: count('removed'),
              changed: count('changed'),
            })}
          </span>
        </p>
      )}
      {sorted.length === 0 && <p className="shell__empty">{t('review.empty')}</p>}
      <ol className="review__list">
        {sorted.map((finding) => {
          const open = finding.id === focusedFindingId;
          const location = findingLocation(finding, flow, compare?.base);
          return (
            <li
              key={finding.id}
              className={`review__item is-${finding.severity}${open ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="review__row"
                aria-expanded={open}
                onClick={() => {
                  onFocus(open ? null : finding.id);
                }}
              >
                <span className={`review__severity is-${finding.severity}`}>
                  <Icon name={finding.severity} size="sm" />
                </span>
                <span className="review__title">{finding.title}</span>
                {location && <span className="review__where">{location}</span>}
              </button>
              {open && (
                <div className="review__body">
                  <FindingDetails finding={finding} showSource commit={commit} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
