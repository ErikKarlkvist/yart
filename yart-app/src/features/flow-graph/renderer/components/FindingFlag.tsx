import { type CSSProperties, type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type ReviewFinding, sortFindings, worstSeverity } from '@/common/model/review';
import { useFindingState } from './GraphStateContext';

interface Props {
  findings: readonly ReviewFinding[];
  className?: string;
  style?: CSSProperties;
}

/**
 * Flaggan med antal fynd på en nod eller en linje. Klick öppnar det
 * allvarligaste fyndet i panelen Review, klick igen går vidare till nästa.
 */
export function FindingFlag({ findings, className = '', style }: Props): JSX.Element | null {
  const { focusedFindingId, focusFinding } = useFindingState();
  const severity = worstSeverity(findings);
  if (!severity) return null;
  const sorted = sortFindings(findings);
  const index = sorted.findIndex((f) => f.id === focusedFindingId);
  const focused = index !== -1;
  const titles = sorted.map((f) => f.title).join('\n');

  return (
    <button
      type="button"
      className={`graph-flag is-${severity}${focused ? ' is-focused' : ''} nodrag nopan ${className}`}
      style={style}
      title={`${t('review.flag', { count: findings.length })}\n${titles}`}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        const next = sorted[(index + 1) % sorted.length];
        if (next) focusFinding(next.id);
      }}
    >
      {t(`review.count.${severity}`, { count: findings.length })}
    </button>
  );
}
