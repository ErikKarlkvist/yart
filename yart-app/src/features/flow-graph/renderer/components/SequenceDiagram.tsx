import {
  type CSSProperties,
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type FlowEdge } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type FlowDiff, type ReviewFinding } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { type AskTarget } from '../../model/ask';
import { formatPayload } from '../../model/format';
import { type GraphNode } from '../../model/graph';
import { edgeHighlight, type FlowHighlight } from '../../model/highlight';
import { type StepStatus } from '../../model/playback';
import { SEQUENCE, type Sequence, type SequenceMessage } from '../../model/sequence';
import { AskButton } from './AskButton';
import { FindingFlag } from './FindingFlag';
import { GraphStateContext } from './GraphStateContext';
import './sequence.css';

interface Props {
  sequence: Sequence;
  stepIndex: number;
  /** Klick på ett meddelande: hoppa dit, och välj grenen om det ligger i en som inte spelas */
  onSelectMessage: (message: SequenceMessage) => void;
  onChooseBranch: (key: string, branch: number) => void;
  onNodeClick?: ((node: GraphNode) => void) | undefined;
  asking: AskTarget | null;
  onAsk: (target: AskTarget) => void;
  onZoom?: ((systemId: string) => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  diff: FlowDiff | null;
  findings: readonly ReviewFinding[];
  focusedFindingId: string | null;
  onFocusFinding: (findingId: string) => void;
  overlay?: ReactNode;
}

type MessageStatus = StepStatus | 'skipped';

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;
/** Ett brett diagram krymps för att få plats, men inte mer än så här */
const MIN_FIT_SCALE = 0.7;
/** Så långt pekaren får röra sig innan ett klick blir ett drag */
const DRAG_THRESHOLD = 4;
/** Rutnätets steg i diagrammets koordinater, samma som grafens */
const GRID = 24;

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
/** Hur långt systemets färgfält når utanför dess yttersta deltagare */
const LANE_PADDING = 14;

/** Stegnummer med två siffror, som 03 */
function stepNumber(n: number): string {
  return String(n).padStart(2, '0');
}

export function SequenceDiagram({
  sequence,
  stepIndex,
  onSelectMessage,
  onChooseBranch,
  onNodeClick,
  asking,
  onAsk,
  onZoom,
  onZoomOut,
  diff,
  findings,
  focusedFindingId,
  onFocusFinding,
  overlay,
}: Props): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Uppspelningen flyttar vyn mjukt; drag och hjul flyttar den direkt
  const [gliding, setGliding] = useState(false);

  // Krymp ett brett diagram så det får plats i bredd, och centrera ett smalt.
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element || view !== null) return;
    const scale = Math.max(MIN_FIT_SCALE, Math.min(1, (element.clientWidth - 16) / sequence.width));
    const x = Math.max(0, (element.clientWidth - sequence.width * scale) / 2);
    setView({ x, y: 0, scale });
  }, [view, sequence.width]);

  // Hjul och tvåfingersdrag flyttar ytan fritt; nyp eller ctrl+hjul zoomar kring pekaren.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      setGliding(false);
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        setView((current) => {
          const from = current ?? { x: 0, y: 0, scale: 1 };
          const scale = clamp(from.scale * Math.exp(-event.deltaY / 200), MIN_SCALE, MAX_SCALE);
          const ratio = scale / from.scale;
          return { scale, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio };
        });
        return;
      }
      setView((current) => {
        const from = current ?? { x: 0, y: 0, scale: 1 };
        return { ...from, x: from.x - event.deltaX, y: from.y - event.deltaY };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Dra var som helst för att flytta ytan, som i grafen. Ett klick som inte rört sig
  // når deltagare, etiketter och knappar som vanligt.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    let drag: { x: number; y: number; id: number; moved: boolean } | null = null;
    let suppressClick = false;
    const onDown = (event: PointerEvent): void => {
      if (event.button !== 0 || (event.target as Element).closest('input, textarea, select'))
        return;
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
    };
    const onMove = (event: PointerEvent): void => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        element.setPointerCapture(drag.id);
        element.classList.add('is-panning');
        setGliding(false);
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      setView((current) => {
        const from = current ?? { x: 0, y: 0, scale: 1 };
        return { ...from, x: from.x + dx, y: from.y + dy };
      });
    };
    const onUp = (): void => {
      if (drag?.moved) {
        suppressClick = true;
        element.releasePointerCapture(drag.id);
        element.classList.remove('is-panning');
      }
      drag = null;
    };
    // Ett drag som slutar på en knapp ska inte räknas som ett klick på den
    const onClick = (event: MouseEvent): void => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('click', onClick, true);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('click', onClick, true);
    };
  }, []);

  // Det aktiva meddelandet flyttas in i bild när uppspelningen går vidare.
  useEffect(() => {
    const element = viewportRef.current;
    const active = element?.querySelector('.sequence-message.is-active');
    if (!element || !active) return;
    const box = element.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    const margin = 48;
    const dx =
      target.left < box.left + margin
        ? box.left + margin - target.left
        : target.right > box.right - margin
          ? box.right - margin - target.right
          : 0;
    const dy =
      target.top < box.top + margin
        ? box.top + margin - target.top
        : target.bottom > box.bottom - margin
          ? box.bottom - margin - target.bottom
          : 0;
    if (dx === 0 && dy === 0) return;
    setGliding(true);
    setView((current) => {
      const from = current ?? { x: 0, y: 0, scale: 1 };
      return { ...from, x: from.x + dx, y: from.y + dy };
    });
  }, [stepIndex, sequence]);

  const statusOf = useCallback(
    (message: SequenceMessage): MessageStatus => {
      if (message.played === null) return 'skipped';
      if (message.played < stepIndex) return 'done';
      return message.played === stepIndex ? 'active' : 'pending';
    },
    [stepIndex],
  );

  const participantStatus = useMemo(() => {
    const result = new Map<string, StepStatus>();
    for (const message of sequence.messages) {
      const status = statusOf(message);
      if (status === 'skipped' || status === 'pending') continue;
      for (const id of [message.from, message.to]) {
        if (status === 'active' || result.get(id) !== 'active') result.set(id, status);
      }
    }
    return result;
  }, [sequence, statusOf]);

  // FindingFlag läser fokus och klick ur samma context som grafen.
  const graphState = useMemo(
    () => ({
      hoveredNodeId: null,
      view: { nodes: new Map(), edges: new Map(), activeEdgeId: null },
      hide: () => undefined,
      askNode: () => undefined,
      askingNodeId: null,
      zoomInto: () => undefined,
      zoomOut: () => undefined,
      focusedFindingId,
      focusFinding: onFocusFinding,
    }),
    [focusedFindingId, onFocusFinding],
  );

  const askingNodeId = asking?.kind === 'node' ? asking.node.id : null;
  const askingEdgeId = asking?.kind === 'edge' ? asking.edge.id : null;
  const lifelineBottom = sequence.height - SEQUENCE.margin / 2;
  const current = view ?? { x: 0, y: 0, scale: 1 };
  const style: CSSProperties = {
    width: sequence.width,
    height: sequence.height,
    transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale})`,
  };
  // Rutnätet följer med när ytan flyttas och zoomas
  const grid = GRID * current.scale;
  const viewportStyle: CSSProperties = {
    backgroundSize: `${grid}px ${grid}px`,
    backgroundPosition: `${current.x}px ${current.y}px`,
    visibility: view ? 'visible' : 'hidden',
  };

  return (
    <div className="sequence">
      <GraphStateContext.Provider value={graphState}>
        <div className="sequence__viewport" ref={viewportRef} style={viewportStyle}>
          <div className={`sequence__canvas${gliding ? ' is-gliding' : ''}`} style={style}>
            <div className="sequence__heads" style={{ height: sequence.headerHeight }}>
              {sequence.bands.map((band) => (
                <div
                  key={band.systemId}
                  className={`sequence-band graph-group--${band.kind}`}
                  style={{ left: band.x, width: band.width }}
                >
                  <Icon name={band.kind} size="sm" />
                  <span className="sequence-band__label">{band.label}</span>
                  {onZoomOut && (
                    <button
                      type="button"
                      className="sequence-band__zoom-out"
                      title={t('graph.zoomOut')}
                      aria-label={t('graph.zoomOut')}
                      onClick={onZoomOut}
                    >
                      <Icon name="zoomOut" size="sm" />
                    </button>
                  )}
                </div>
              ))}
              {sequence.participants.map(({ node, x, width }) => {
                const status = participantStatus.get(node.id) ?? 'pending';
                const focused =
                  focusedFindingId !== null && node.findings.some((f) => f.id === focusedFindingId);
                return (
                  <div
                    key={node.id}
                    className={`sequence-participant graph-node graph-node--${node.kind} graph-node--${node.level} is-${status}${askingNodeId === node.id ? ' is-asking' : ''}${focused ? ' is-focused' : ''}${node.change ? ` is-change-${node.change}` : ''}`}
                    style={{
                      left: x - width / 2,
                      width,
                      top: sequence.boxTop,
                      height: sequence.boxHeight,
                    }}
                    title={node.description}
                    onClick={() => onNodeClick?.(node)}
                  >
                    <span className="graph-node__header">
                      <Icon name={node.kind} size="sm" />
                      <span className="graph-node__kind">
                        {node.role ?? t(`kind.${node.kind}`)}
                      </span>
                      <span className="graph-node__spacer" />
                      {node.level === 'system' && node.memberCount !== undefined && (
                        <span className="graph-node__count">
                          {t('graph.nodeCount', { count: node.memberCount })}
                        </span>
                      )}
                      {node.change && (
                        <span className={`graph-node__change is-${node.change}`}>
                          {t(`review.${node.change}`)}
                        </span>
                      )}
                    </span>
                    <span className="graph-node__label">{node.label}</span>
                    <FindingFlag findings={node.findings} className="graph-node__flag" />
                    {node.level === 'system' && onZoom && (
                      <button
                        type="button"
                        className="graph-node__zoom"
                        title={t('graph.zoomHint', { name: node.label })}
                        aria-label={t('graph.zoomHint', { name: node.label })}
                        onClick={(event) => {
                          event.stopPropagation();
                          onZoom(node.id);
                        }}
                      >
                        <Icon name="zoomIn" size="sm" />
                      </button>
                    )}
                    <AskButton
                      onAsk={() => {
                        onAsk({ kind: 'node', node });
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Systemets färg följer med hela vägen ned bakom dess livlinjer */}
            {sequence.bands.map((band) => (
              <div
                key={band.systemId}
                className={`sequence-lane graph-group--${band.kind}`}
                style={{
                  left: band.x - LANE_PADDING,
                  width: band.width + 2 * LANE_PADDING,
                  top: 0,
                  height: sequence.height,
                }}
              />
            ))}

            <svg className="sequence__lines" width={sequence.width} height={sequence.height}>
              <defs>
                {[
                  'pending',
                  'active',
                  'done',
                  'skipped',
                  'added',
                  'changed',
                  'removed',
                  'problem',
                  'warning',
                ].map((kind) => (
                  <marker
                    key={kind}
                    id={`sequence-arrow-${kind}`}
                    className={`sequence-arrow is-${kind}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" />
                  </marker>
                ))}
              </defs>
              {sequence.participants.map(({ node, x }) => (
                <line
                  key={node.id}
                  className={`sequence-lifeline is-${participantStatus.get(node.id) ?? 'pending'}`}
                  x1={x}
                  x2={x}
                  y1={sequence.headerHeight}
                  y2={lifelineBottom}
                />
              ))}
              {sequence.fragments.map((fragment) => (
                <g
                  key={fragment.key}
                  className={`sequence-fragment${fragment.played ? '' : ' is-skipped'}`}
                >
                  <rect
                    x={fragment.x}
                    y={fragment.y}
                    width={fragment.width}
                    height={fragment.height}
                  />
                  {fragment.branches.slice(1).map((branch) => (
                    <line
                      key={branch.index}
                      className="sequence-fragment__divider"
                      x1={fragment.x}
                      x2={fragment.x + fragment.width}
                      y1={branch.y}
                      y2={branch.y}
                    />
                  ))}
                </g>
              ))}
              {sequence.trigger && (
                <g className="sequence-trigger">
                  <circle cx={sequence.trigger.startX} cy={sequence.trigger.y} r="5" />
                  <line
                    x1={sequence.trigger.startX + 5}
                    x2={sequence.trigger.x - 2}
                    y1={sequence.trigger.y}
                    y2={sequence.trigger.y}
                    markerEnd="url(#sequence-arrow-done)"
                  />
                </g>
              )}
              {sequence.messages.map((message) => {
                const status = statusOf(message);
                const highlight = messageHighlight(message, diff, findings);
                const path = messagePath(message);
                const marker = highlight ?? status;
                return (
                  <g key={message.id}>
                    <path
                      d={path}
                      className={`sequence-arrow-line is-${status}${message.isReturn ? ' is-return' : ''}${highlight ? ` is-highlight-${highlight}` : ''}${askingEdgeId === message.edge.id ? ' is-asking' : ''}`}
                      markerEnd={`url(#sequence-arrow-${marker})`}
                    />
                    {status === 'active' && (
                      <circle
                        r="4"
                        className={`graph-edge__pulse${highlight ? ` is-highlight-${highlight}` : ''}`}
                      >
                        <animateMotion dur="1.2s" repeatCount="indefinite" path={path} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {sequence.trigger && (
              <div
                className={`sequence-trigger__label is-${sequence.trigger.kind}`}
                style={{ left: sequence.trigger.startX - 6, top: sequence.trigger.y - 6 }}
                title={t('graph.triggerHint', { label: sequence.trigger.label })}
              >
                <Icon name="trigger" size="sm" />
                <span className="sequence-trigger__kind">{sequence.trigger.kind}</span>
                <span className="sequence-trigger__text">{sequence.trigger.label}</span>
              </div>
            )}

            {sequence.fragments.map((fragment) => (
              <div
                key={fragment.key}
                className={`sequence-fragment__labels${fragment.played ? '' : ' is-skipped'}`}
              >
                <div
                  className="sequence-fragment__title"
                  style={{ left: fragment.x, top: fragment.y }}
                >
                  <span className="sequence-fragment__tag">{t('sequence.alt')}</span>
                  <span className="sequence-fragment__condition">{fragment.label}</span>
                </div>
                {fragment.branches.map((branch) => (
                  <button
                    key={branch.index}
                    type="button"
                    className={`sequence-branch${branch.selected ? ' is-selected' : ''}${branch.played ? ' is-played' : ''}`}
                    style={{ left: fragment.x + 8, top: branch.y + 3 }}
                    title={t('sequence.chooseBranch', { label: branch.label })}
                    aria-pressed={branch.selected}
                    onClick={() => {
                      onChooseBranch(fragment.key, branch.index);
                    }}
                  >
                    {branch.label}
                    {branch.empty && (
                      <span className="sequence-branch__empty">{t('sequence.emptyBranch')}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}

            {sequence.messages.map((message) => {
              const status = statusOf(message);
              const memberFindings = findings.filter((f) => f.edgeId === message.edge.id);
              const change = diff?.edges.get(message.edge.id) ?? message.edge.highlight;
              const highlight = messageHighlight(message, diff, findings);
              const open = hovered === message.id || askingEdgeId === message.edge.id;
              const focused =
                focusedFindingId !== null && memberFindings.some((f) => f.id === focusedFindingId);
              const position: CSSProperties = message.self
                ? {
                    left: message.x1 + SEQUENCE.selfWidth + 10,
                    top: message.y + SEQUENCE.selfHeight / 2,
                  }
                : { left: (message.x1 + message.x2) / 2, top: message.y - 4 };
              return (
                <div
                  key={message.id}
                  className={`sequence-message is-${status}${message.self ? ' is-self' : ''}${highlight ? ` is-highlight-${highlight}` : ''}${open ? ' is-open' : ''}${focused ? ' is-focused' : ''}`}
                  style={position}
                  onMouseEnter={() => {
                    setHovered(message.id);
                  }}
                  onMouseLeave={() => {
                    setHovered((current) => (current === message.id ? null : current));
                  }}
                >
                  <button
                    type="button"
                    className="sequence-message__label"
                    title={message.step?.description}
                    onClick={() => {
                      onSelectMessage(message);
                    }}
                  >
                    <span className="sequence-message__number">
                      {message.played !== null ? stepNumber(message.played + 1) : ''}
                    </span>
                    <span className="sequence-message__text">{message.edge.label}</span>
                    {change && (
                      <span className={`graph-node__change is-${change}`}>
                        {t(`review.${change}`)}
                      </span>
                    )}
                  </button>
                  <FindingFlag findings={memberFindings} className="sequence-message__flag" />
                  {open && (
                    <MessageDetails
                      edge={message.edge}
                      onAsk={() => {
                        onAsk({ kind: 'edge', edge: message.edge });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {overlay}
      </GraphStateContext.Provider>
    </div>
  );
}

/** Det som skickas och kommer tillbaka, under etiketten när musen är över den. */
function MessageDetails({ edge, onAsk }: { edge: FlowEdge; onAsk: () => void }): JSX.Element {
  return (
    <div className="sequence-message__details">
      {edge.payload && (
        <div className="graph-edge-label__row is-sends">
          <span
            className="graph-edge-label__arrow"
            title={t('graph.sends')}
            aria-label={t('graph.sends')}
          >
            →
          </span>
          <pre className="graph-edge-label__value">{formatPayload(edge.payload)}</pre>
        </div>
      )}
      {edge.response && (
        <div className="graph-edge-label__row is-response">
          <span
            className="graph-edge-label__arrow"
            title={t('graph.response')}
            aria-label={t('graph.response')}
          >
            ←
          </span>
          <pre className="graph-edge-label__value">{formatPayload(edge.response)}</pre>
        </div>
      )}
      <AskButton onAsk={onAsk} />
    </div>
  );
}

function messageHighlight(
  message: SequenceMessage,
  diff: FlowDiff | null,
  findings: readonly ReviewFinding[],
): FlowHighlight | undefined {
  return edgeHighlight(
    diff?.edges.get(message.edge.id) ?? message.edge.highlight,
    findings.filter((f) => f.edgeId === message.edge.id),
  );
}

/** En rak pil mellan livlinjerna, eller en ögla tillbaka till samma livlinje. */
function messagePath(message: SequenceMessage): string {
  const { x1, x2, y } = message;
  if (message.self) {
    const right = x1 + SEQUENCE.selfWidth;
    const bottom = y + SEQUENCE.selfHeight;
    return `M ${x1} ${y} L ${right} ${y} L ${right} ${bottom} L ${x1 + 2} ${bottom}`;
  }
  // Pilen stannar strax före livlinjen så spetsen syns
  const end = x2 > x1 ? x2 - 2 : x2 + 2;
  return `M ${x1} ${y} L ${end} ${y}`;
}
