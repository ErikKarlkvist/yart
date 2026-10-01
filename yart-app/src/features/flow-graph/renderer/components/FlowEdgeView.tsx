import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { type JSX, memo } from 'react';
import { t } from '@/common/model/i18n';
import { type FlowChange, type ReviewFinding } from '@/common/model/review';
import { formatPayload } from '../../model/format';
import { type Direction } from '../../model/layout';
import { type StepStatus } from '../../model/playback';
import { edgeHighlight, type FlowHighlight } from '../../model/highlight';
import { AskButton } from './AskButton';
import { FindingFlag } from './FindingFlag';

export interface EdgeMemberData {
  id: string;
  label: string;
  payload: string | undefined;
  response: string | undefined;
  status: StepStatus;
  /** Stegnummer (1-baserade) i aktuell vy där anropet spelas upp */
  steps: number[];
  change: FlowChange | undefined;
  findings: ReviewFinding[];
}

// React Flow kräver Record<string, unknown>, vilket ett interface inte uppfyller.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type GraphEdgeData = {
  /** Anropen som ritas på den här linjen, i flödets ordning */
  members: EdgeMemberData[];
  /** Linjens status: aktiv om något anrop är aktivt, annars klar om något är klart */
  status: StepStatus;
  offset: number;
  direction: Direction;
  hovered: boolean;
  /** Anropet som är utpekat i frågerutan, om det ligger på den här linjen */
  askingId: string | null;
  onAsk: (memberId: string) => void;
  /** Listan är fäst efter klick på siffran */
  pinned: boolean;
  onTogglePinned: (edgeId: string) => void;
  /** Hoppar i uppspelningen, 0-baserat */
  onGoToStep: (index: number) => void;
  /** Strongest change or issue on this drawn line. */
  highlight: FlowHighlight | undefined;
  /** Ett av linjens fynd är valt i panelen Review */
  focused: boolean;
};

/** Hur långt från linjen etiketten sitter, i pixlar */
const LABEL_DISTANCE = 26;

export type GraphEdge = Edge<GraphEdgeData, 'flow'>;

/**
 * En linje mellan två noder. Etiketten visas bara för anropet som spelas upp
 * just nu, eller för alla anrop på linjen när man håller musen över eller
 * markerar den.
 */
export const FlowEdgeView = memo(function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<GraphEdge>): JSX.Element | null {
  if (!data) return null;
  const vertical = data.direction === 'up' || data.direction === 'down';
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sourceX + (vertical ? data.offset : 0),
    sourceY: sourceY + (vertical ? 0 : data.offset),
    targetX: targetX + (vertical ? data.offset : 0),
    targetY: targetY + (vertical ? 0 : data.offset),
    sourcePosition,
    targetPosition,
  });
  const open = data.hovered || selected === true || data.askingId !== null || data.pinned;
  const multiple = data.members.length > 1;
  const findings = data.members.flatMap((m) => m.findings);
  const active = data.members.find((m) => m.status === 'active');
  const shown = open ? data.members : active ? [active] : [];
  // Framåtkanter får etiketten ovanför linjen, svar under, så linjen syns.
  const side = data.direction === 'forward' || data.direction === 'up' ? -1 : 1;
  const labelOffsetY = labelY + side * LABEL_DISTANCE;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`graph-edge is-${data.status}${selected ? ' is-selected' : ''}${data.askingId ? ' is-asking' : ''}${data.focused ? ' is-focused' : ''}${data.highlight ? ` is-highlight-${data.highlight}` : ''}`}
        markerEnd={`url(#graph-arrow-${data.highlight ? `highlight-${data.highlight}` : data.status})`}
      />
      {shown.length > 0 && (
        <line
          className={`graph-edge__leader is-${data.status}${data.highlight ? ` is-highlight-${data.highlight}` : ''}`}
          x1={labelX}
          y1={labelY}
          x2={labelX}
          y2={labelOffsetY}
        />
      )}
      {data.status === 'active' && (
        <circle
          r="5"
          className={`graph-edge__pulse${data.highlight ? ` is-highlight-${data.highlight}` : ''}`}
        >
          <animateMotion dur="1.2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      <EdgeLabelRenderer>
        {findings.length > 0 && (
          <FindingFlag
            findings={findings}
            className="graph-edge-flag"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + (multiple ? -18 : 0)}px, ${labelY}px)`,
            }}
          />
        )}
        {multiple && (
          <button
            type="button"
            className={`graph-edge-badge is-${data.status}${data.pinned ? ' is-pinned' : ''} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={t('graph.callsOnLine', { count: data.members.length })}
            onClick={(event) => {
              event.stopPropagation();
              data.onTogglePinned(id);
            }}
          >
            {data.members.length}
          </button>
        )}
        {shown.length > 0 && (
          <div
            className={`graph-edge-label is-${data.status}${data.highlight ? ` is-highlight-${data.highlight}` : ''}${open ? ' is-open' : ''}${data.pinned ? ' is-pinned' : ''} graph-edge-label--${data.direction}`}
            style={{
              transform: `translate(-50%, ${side < 0 ? '-100%' : '0'}) translate(${labelX}px, ${labelOffsetY}px)`,
            }}
          >
            {shown.map((member) => (
              <div
                key={member.id}
                className={`graph-edge-label__member is-${member.status}${member.id === data.askingId ? ' is-asking' : ''}${edgeHighlight(member.change, member.findings) ? ` is-highlight-${edgeHighlight(member.change, member.findings)}` : ''}`}
              >
                <span className="graph-edge-label__text">
                  {open && member.steps.length > 0 && (
                    <button
                      type="button"
                      className="graph-edge-label__step nodrag nopan"
                      title={t('graph.goToStep', { step: member.steps[0] ?? 0 })}
                      onClick={(event) => {
                        event.stopPropagation();
                        data.onGoToStep((member.steps[0] ?? 1) - 1);
                      }}
                    >
                      {member.steps.map((n) => `#${n}`).join(' ')}
                    </button>
                  )}
                  {member.label}
                  {open && member.change && (
                    <span className={`graph-node__change is-${member.change}`}>
                      {t(`review.${member.change}`)}
                    </span>
                  )}
                  {open && (
                    <AskButton
                      onAsk={() => {
                        data.onAsk(member.id);
                      }}
                    />
                  )}
                </span>
                {open && (member.payload ?? member.response) && (
                  <div className="graph-edge-label__details">
                    {member.payload && (
                      <div className="graph-edge-label__row is-sends">
                        <span
                          className="graph-edge-label__arrow"
                          title={t('graph.sends')}
                          aria-label={t('graph.sends')}
                        >
                          →
                        </span>
                        <pre className="graph-edge-label__value">
                          {formatPayload(member.payload)}
                        </pre>
                      </div>
                    )}
                    {member.response && (
                      <div className="graph-edge-label__row is-response">
                        <span
                          className="graph-edge-label__arrow"
                          title={t('graph.response')}
                          aria-label={t('graph.response')}
                        >
                          ←
                        </span>
                        <pre className="graph-edge-label__value">
                          {formatPayload(member.response)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
