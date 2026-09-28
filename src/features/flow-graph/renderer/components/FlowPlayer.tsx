import '@xyflow/react/dist/style.css';
import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Flow, type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { diffFlows, mergeForReview, type Review } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import {
  buildModel,
  type GraphNode,
  type GraphView,
  hideElements,
  mapStepIndex,
} from '../../model/graph';
import { type AskTarget, buildAskPrompt } from '../../model/ask';
import { type Point } from '../../model/layout';
import { AskComposer } from './AskComposer';
import { useFlowPlayback } from '../hooks/useFlowPlayback';
import { FlowGraph } from './FlowGraph';
import { PlaybackControls } from './PlaybackControls';
import './graph.css';

interface Props {
  flow: Flow;
  /** Anropas när aktivt steg byts, med kanten som steget spelar upp. */
  onActiveEdgeChange?: (edge: FlowEdge | null) => void;
  onSelectSource?: (source: SourceRef) => void;
  /** Renderas mellan grafen och kontrollerna, t.ex. ett draghandtag som ägs av appen. */
  beforeControls?: ReactNode;
  /** Filen i repot flödet kom från, så agenten kan uppdatera den */
  /** Namnet flödet är sparat under, så agenten kan spara om det */
  flowName?: string | undefined;
  /** Tar emot frågan om en nod eller ett anrop, färdig att skicka till agenten */
  onAsk?: ((prompt: string) => void) | undefined;
  /** Finns när analysen är en review: `flow` är då flödet efter ändringen */
  review?: Review | undefined;
  focusedFindingId?: string | null | undefined;
  /** Räknas upp vid varje fokusering, uppspelningen spolar då till fyndets steg */
  focusSeq?: number | undefined;
  onFocusFinding?: ((findingId: string) => void) | undefined;
}

/**
 * Graf med uppspelning. Börjar i systemvyn, klick på ett system zoomar in i
 * det. Montera om med `key` när flödet byts så uppspelningen börjar om.
 */
export function FlowPlayer({
  flow,
  onActiveEdgeChange,
  onSelectSource,
  beforeControls,
  flowName,
  onAsk,
  review,
  focusedFindingId = null,
  focusSeq = 0,
  onFocusFinding,
}: Props): JSX.Element {
  const [view, setView] = useState<GraphView>({ kind: 'system' });
  // Det användaren dolt gäller i alla vyer. Flyttade noder sparas per vy.
  const [hiddenNodes, setHiddenNodes] = useState<ReadonlySet<string>>(() => new Set());
  const [hiddenEdges, setHiddenEdges] = useState<ReadonlySet<string>>(() => new Set());
  const [moved, setMoved] = useState<ReadonlyMap<string, Point>>(() => new Map());
  // I en review ritas även det som tagits bort ur base, som spöken.
  const diff = useMemo(() => (review ? diffFlows(review.base, flow) : null), [review, flow]);
  const graphFlow = useMemo(
    () => (review && diff ? mergeForReview(flow, review.base, diff) : flow),
    [flow, review, diff],
  );
  const annotations = useMemo(
    () => (review && diff ? { diff, findings: review.findings } : undefined),
    [review, diff],
  );
  const model = useMemo(
    () => hideElements(buildModel(graphFlow, view, annotations), hiddenNodes, hiddenEdges),
    [graphFlow, view, annotations, hiddenNodes, hiddenEdges],
  );
  const playback = useFlowPlayback(model.steps.length);
  const hiddenCount = hiddenNodes.size + hiddenEdges.size;
  const [asking, setAsking] = useState<AskTarget | null>(null);
  const cancelAsk = useCallback(() => {
    setAsking(null);
  }, []);
  const sendAsk = useCallback(
    (question: string) => {
      if (asking) onAsk?.(buildAskPrompt(flow, asking, question, flowName));
      setAsking(null);
    },
    [asking, flow, flowName, onAsk],
  );

  useEffect(() => {
    const step = model.steps[playback.stepIndex];
    const edge = step ? graphFlow.edges.find((e) => e.id === step.edgeId) : undefined;
    onActiveEdgeChange?.(edge ?? null);
  }, [graphFlow, model, playback.stepIndex, onActiveEdgeChange]);

  /** Byter vy och flyttar uppspelningen till motsvarande steg i den nya vyn. */
  const changeView = useCallback(
    (next: GraphView) => {
      const nextModel = buildModel(graphFlow, next, annotations);
      playback.goTo(mapStepIndex(graphFlow, model, playback.stepIndex, nextModel));
      setView(next);
    },
    [graphFlow, annotations, model, playback],
  );

  // Klick visar koden. Inzoomning sker via förstoringsglaset på systemnoden.
  const onNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.source) onSelectSource?.(node.source);
    },
    [onSelectSource],
  );
  const onZoom = useCallback(
    (systemId: string) => {
      changeView({ kind: 'focus', systemId });
    },
    [changeView],
  );
  const onZoomOut = useCallback(() => {
    changeView({ kind: 'system' });
  }, [changeView]);
  const focusFinding = useCallback(
    (findingId: string) => {
      onFocusFinding?.(findingId);
    },
    [onFocusFinding],
  );

  // Spola till första steget som rör fyndets nod eller anrop, en gång per fokusering.
  const handledFocus = useRef(0);
  useEffect(() => {
    if (handledFocus.current === focusSeq || !review || focusedFindingId === null) return;
    handledFocus.current = focusSeq;
    const finding = review.findings.find((f) => f.id === focusedFindingId);
    if (!finding) return;
    const index = model.steps.findIndex((step) => {
      const edge = graphFlow.edges.find((e) => e.id === step.edgeId);
      return (
        edge !== undefined &&
        (edge.id === finding.edgeId || edge.from === finding.nodeId || edge.to === finding.nodeId)
      );
    });
    if (index >= 0) playback.goTo(index);
  }, [focusSeq, focusedFindingId, review, model, graphFlow, playback]);
  const onEdgeClick = useCallback(
    (edge: FlowEdge) => {
      onSelectSource?.(edge.source);
    },
    [onSelectSource],
  );

  const focused = view.kind === 'focus' ? flow.systems.find((s) => s.id === view.systemId) : null;
  const viewKey = view.kind === 'focus' ? `focus:${view.systemId}` : view.kind;

  const movedInView = useMemo(() => {
    const prefix = `${viewKey}/`;
    const result = new Map<string, Point>();
    for (const [key, point] of moved) {
      if (key.startsWith(prefix)) result.set(key.slice(prefix.length), point);
    }
    return result;
  }, [moved, viewKey]);
  const onMove = useCallback(
    (nodeId: string, position: Point) => {
      setMoved((current) => new Map(current).set(`${viewKey}/${nodeId}`, position));
    },
    [viewKey],
  );
  const onHideNodes = useCallback((ids: string[]) => {
    setHiddenNodes((current) => new Set([...current, ...ids]));
  }, []);
  const onHideEdges = useCallback((ids: string[]) => {
    setHiddenEdges((current) => new Set([...current, ...ids]));
  }, []);
  const restoreHidden = useCallback(() => {
    setHiddenNodes(new Set());
    setHiddenEdges(new Set());
  }, []);

  return (
    <div className="player">
      <header className="player__header">
        <div className="player__heading">
          <h2 className="player__title" title={flow.summary}>
            {flow.title}
          </h2>
          {review && (
            <span className="player__review">
              <span className="player__compare">
                {t('review.compare', { base: review.baseLabel, head: review.headLabel })}
              </span>
              <span className="player__findings">
                {t('review.findings', { count: review.findings.length })}
              </span>
            </span>
          )}
        </div>
        <nav className="player__crumbs" aria-label={t('graph.levelNav')}>
          <button
            type="button"
            className={`crumb${view.kind === 'system' ? ' is-current' : ''}`}
            onClick={() => {
              changeView({ kind: 'system' });
            }}
          >
            {t('graph.allSystems')}
          </button>
          {focused && (
            <>
              <Icon name="chevronRight" size="sm" />
              <span className="crumb is-current">
                <Icon name={focused.kind} size="sm" /> {focused.label}
              </span>
            </>
          )}
          <span className="player__crumbs-spacer" />
          {hiddenCount > 0 && (
            <button type="button" className="crumb" onClick={restoreHidden}>
              {t('graph.restoreHidden', { count: hiddenCount })}
            </button>
          )}
          <button
            type="button"
            className={`crumb crumb--toggle${view.kind === 'detail' ? ' is-current' : ''}`}
            title={t('graph.allDetailsHint')}
            onClick={() => {
              changeView(view.kind === 'detail' ? { kind: 'system' } : { kind: 'detail' });
            }}
          >
            {t('graph.allDetails')}
          </button>
        </nav>
      </header>
      <FlowGraph
        key={viewKey}
        model={model}
        stepIndex={playback.stepIndex}
        moved={movedInView}
        onMove={onMove}
        onHideNodes={onHideNodes}
        onHideEdges={onHideEdges}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        asking={onAsk ? asking : null}
        onAsk={setAsking}
        onZoom={onZoom}
        onZoomOut={onZoomOut}
        onGoToStep={playback.goTo}
        diff={diff}
        findings={review?.findings ?? []}
        focusedFindingId={focusedFindingId}
        onFocusFinding={focusFinding}
        overlay={
          onAsk && asking ? (
            <AskComposer
              key={askKey(asking)}
              target={asking}
              onSend={sendAsk}
              onCancel={cancelAsk}
            />
          ) : null
        }
      />
      <div className="player__divider">{beforeControls}</div>
      <PlaybackControls steps={model.steps} playback={playback} />
    </div>
  );
}

function askKey(target: AskTarget): string {
  return target.kind === 'node' ? `node:${target.node.id}` : `edge:${target.edge.id}`;
}
