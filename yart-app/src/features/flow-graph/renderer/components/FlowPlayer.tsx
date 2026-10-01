import '@xyflow/react/dist/style.css';
import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Flow, type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import {
  diffFlows,
  type FlowCompare,
  mergeForReview,
  type ReviewFinding,
} from '@/common/model/review';
import {
  type AltChoices,
  choicesFor,
  choicesForBranch,
  playedAlts,
  resolveSteps,
} from '@/common/model/steps';
import { Icon } from '@/common/renderer/Icon';
import { useStoredChoice } from '@/common/renderer/useStored';
import {
  buildModel,
  type GraphNode,
  type GraphView,
  hideElements,
  mapStepIndex,
} from '../../model/graph';
import { buildSequence, type SequenceMessage } from '../../model/sequence';
import { type AskTarget, buildAskPrompt } from '../../model/ask';
import { type Point } from '../../model/layout';
import { edgeHighlight, type FlowHighlight } from '../../model/highlight';
import { AskComposer } from './AskComposer';
import { useFlowPlayback } from '../hooks/useFlowPlayback';
import { FlowGraph } from './FlowGraph';
import { PlaybackControls } from './PlaybackControls';
import { SequenceDiagram } from './SequenceDiagram';
import './graph.css';

const LAYOUTS = ['sequence', 'graph'] as const;
type FlowLayout = (typeof LAYOUTS)[number];

interface Props {
  flow: Flow;
  /** Anropas när aktivt steg byts, med kanten som steget spelar upp. */
  onActiveEdgeChange?: (edge: FlowEdge | null) => void;
  onSelectSource?: (source: SourceRef) => void;
  /** Renderas mellan grafen och kontrollerna, t.ex. ett draghandtag som ägs av appen. */
  beforeControls?: ReactNode;
  /** Namnet flödet är sparat under, så agenten kan spara om det */
  flowName?: string | undefined;
  /** Tar emot frågan om en nod eller ett anrop, färdig att ge till agenten */
  onAsk?: ((prompt: string) => void) | undefined;
  /** Finns när flödet beskriver en ändring: `flow` är då flödet efter den */
  compare?: FlowCompare | undefined;
  /** Fynden i repots reviewer som pekar på det här flödet */
  findings?: readonly ReviewFinding[] | undefined;
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
  compare,
  findings = [],
  focusedFindingId = null,
  focusSeq = 0,
  onFocusFinding,
}: Props): JSX.Element {
  const [view, setView] = useState<GraphView>({ kind: 'system' });
  const [layout, setLayout] = useStoredChoice<FlowLayout>('yart.flowLayout', LAYOUTS, 'sequence');
  // Grenen som spelas i varje alternativ; första grenen om inget valts
  const [choices, setChoices] = useState<AltChoices>(() => new Map());
  // Det användaren dolt gäller i alla vyer. Flyttade noder sparas per vy.
  const [hiddenNodes, setHiddenNodes] = useState<ReadonlySet<string>>(() => new Set());
  const [hiddenEdges, setHiddenEdges] = useState<ReadonlySet<string>>(() => new Set());
  const [moved, setMoved] = useState<ReadonlyMap<string, Point>>(() => new Map());
  // I en jämförelse ritas även det som tagits bort ur base, som spöken.
  const diff = useMemo(() => (compare ? diffFlows(compare.base, flow) : null), [compare, flow]);
  const graphFlow = useMemo(
    () => (compare && diff ? mergeForReview(flow, compare.base, diff) : flow),
    [flow, compare, diff],
  );
  const annotations = useMemo(
    () =>
      diff || findings.length > 0
        ? { diff: diff ?? { nodes: new Map(), edges: new Map() }, findings }
        : undefined,
    [diff, findings],
  );
  const model = useMemo(
    () =>
      hideElements(buildModel(graphFlow, view, annotations, { choices }), hiddenNodes, hiddenEdges),
    [graphFlow, view, annotations, choices, hiddenNodes, hiddenEdges],
  );
  // Alla spelade steg; sekvensdiagrammet spelar dem alla, grafen bara de som syns på nivån
  const played = useMemo(() => resolveSteps(graphFlow.steps, choices), [graphFlow, choices]);
  const removed = useMemo(
    () =>
      compare && diff
        ? {
            baseSteps: resolveSteps(compare.base.steps),
            removedEdgeIds: new Set(
              [...diff.edges].filter(([, change]) => change === 'removed').map(([id]) => id),
            ),
          }
        : null,
    [compare, diff],
  );
  const sequence = useMemo(
    () =>
      layout === 'sequence' ? buildSequence(graphFlow, view, annotations, choices, removed) : null,
    [layout, graphFlow, view, annotations, choices, removed],
  );
  const steps = sequence ? sequence.steps : model.steps;
  const alts = useMemo(() => playedAlts(graphFlow.steps, choices), [graphFlow, choices]);
  const highlights = useMemo(() => {
    const result = new Map<string, FlowHighlight>();
    for (const edge of model.edges) {
      const highlight = edgeHighlight(
        diff?.edges.get(edge.id) ?? edge.highlight,
        findings.filter((finding) => finding.edgeId === edge.id),
      );
      if (highlight) result.set(edge.id, highlight);
    }
    return result;
  }, [model.edges, diff, findings]);
  const legend = (['added', 'changed', 'removed', 'problem', 'warning'] as const).filter((kind) =>
    kind === 'problem' || kind === 'warning'
      ? [...highlights.values()].includes(kind)
      : [...highlights.values(), ...model.nodes.map((node) => node.change)].includes(kind),
  );
  const playback = useFlowPlayback(steps.length);
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
    const step = steps[playback.stepIndex];
    const edge = step ? graphFlow.edges.find((e) => e.id === step.edgeId) : undefined;
    onActiveEdgeChange?.(edge ?? null);
  }, [graphFlow, steps, playback.stepIndex, onActiveEdgeChange]);

  /** Byter vy och flyttar uppspelningen till motsvarande steg i den nya vyn. */
  const changeView = useCallback(
    (next: GraphView) => {
      // Sekvensdiagrammet spelar samma steg på alla nivåer
      if (layout === 'graph') {
        const nextModel = buildModel(graphFlow, next, annotations, { choices });
        playback.goTo(mapStepIndex(played, steps, playback.stepIndex, nextModel.steps));
      }
      setView(next);
    },
    [layout, graphFlow, annotations, choices, played, steps, playback],
  );
  const changeLayout = useCallback(
    (next: FlowLayout) => {
      if (next === layout) return;
      const nextSteps = next === 'sequence' ? played : model.steps;
      playback.goTo(mapStepIndex(played, steps, playback.stepIndex, nextSteps));
      setLayout(next);
    },
    [layout, played, model, steps, playback, setLayout],
  );

  /**
   * Väljer en gren och spelar från dess första steg. En tom gren lämnar
   * uppspelningen där den är.
   */
  const chooseBranch = useCallback(
    (key: string, branch: number) => {
      const next = new Map([...choices, ...choicesForBranch(key, branch)]);
      setChoices(next);
      const nextPlayed = resolveSteps(graphFlow.steps, next);
      const first = nextPlayed.find(
        (step) => choicesFor(graphFlow.steps, step)?.get(key) === branch,
      );
      if (!first) return;
      const nextSteps =
        layout === 'sequence'
          ? nextPlayed
          : buildModel(graphFlow, view, annotations, { choices: next }).steps;
      playback.goTo(mapStepIndex(nextPlayed, [first], 0, nextSteps));
    },
    [choices, graphFlow, layout, view, annotations, playback],
  );

  /** Klick på ett meddelande hoppar dit, via grenen det ligger i om den inte spelas. */
  const selectMessage = useCallback(
    (message: SequenceMessage) => {
      if (message.edge.source) onSelectSource?.(message.edge.source);
      const step = message.step;
      if (!step) return;
      if (message.played !== null) {
        playback.goTo(message.played);
        return;
      }
      const needed = choicesFor(graphFlow.steps, step);
      if (!needed) return;
      const next = new Map([...choices, ...needed]);
      setChoices(next);
      const index = resolveSteps(graphFlow.steps, next).indexOf(step);
      if (index >= 0) playback.goTo(index);
    },
    [choices, graphFlow, playback, onSelectSource],
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
    if (handledFocus.current === focusSeq || focusedFindingId === null) return;
    handledFocus.current = focusSeq;
    const finding = findings.find((f) => f.id === focusedFindingId);
    if (!finding) return;
    const index = steps.findIndex((step) => {
      const edge = graphFlow.edges.find((e) => e.id === step.edgeId);
      return (
        edge !== undefined &&
        (edge.id === finding.edgeId || edge.from === finding.nodeId || edge.to === finding.nodeId)
      );
    });
    if (index >= 0) playback.goTo(index);
  }, [focusSeq, focusedFindingId, findings, steps, graphFlow, playback]);
  const onEdgeClick = useCallback(
    (edge: FlowEdge) => {
      if (edge.source) onSelectSource?.(edge.source);
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

  const overlay =
    onAsk && asking ? (
      <AskComposer
        key={askKey(asking)}
        target={asking}
        onSend={sendAsk}
        onCopy={(question) =>
          navigator.clipboard.writeText(buildAskPrompt(flow, asking, question, flowName))
        }
        onCancel={cancelAsk}
      />
    ) : null;

  return (
    <div className="player">
      <header className="player__header">
        <div className="player__heading">
          <h2 className="player__title" title={flow.summary}>
            {flow.title}
          </h2>
          {flow.trigger && (
            <span className="player__trigger">
              {t('graph.startsWhen')} <strong>{flow.trigger.label}</strong>
            </span>
          )}
          {(compare !== undefined || findings.length > 0) && (
            <span className="player__review">
              {compare && (
                <span className="player__compare">
                  {t('review.compare', { base: compare.baseLabel, head: compare.headLabel })}
                </span>
              )}
              {findings.length > 0 && (
                <span className="player__findings">
                  {t('review.findings', { count: findings.length })}
                </span>
              )}
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
          {layout === 'graph' && hiddenCount > 0 && (
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
          <span className="player__layouts" role="group" aria-label={t('graph.layout')}>
            {LAYOUTS.map((option) => (
              <button
                key={option}
                type="button"
                className={`player__layout${layout === option ? ' is-current' : ''}`}
                aria-pressed={layout === option}
                title={t(
                  option === 'sequence' ? 'graph.layoutSequenceHint' : 'graph.layoutGraphHint',
                )}
                onClick={() => {
                  changeLayout(option);
                }}
              >
                {t(option === 'sequence' ? 'graph.layoutSequence' : 'graph.layoutGraph')}
              </button>
            ))}
          </span>
        </nav>
        {legend.length > 0 && (
          <div className="player__legend" aria-label={t('flow.highlight.legend')}>
            {legend.map((kind) => (
              <span key={kind} className={`player__legend-item is-highlight-${kind}`}>
                <span className="player__legend-swatch" /> {t(`flow.highlight.${kind}`)}
              </span>
            ))}
          </div>
        )}
      </header>
      {sequence ? (
        <SequenceDiagram
          key={viewKey}
          sequence={sequence}
          stepIndex={playback.stepIndex}
          onSelectMessage={selectMessage}
          onChooseBranch={chooseBranch}
          onNodeClick={onNodeClick}
          asking={onAsk ? asking : null}
          onAsk={setAsking}
          onZoom={onZoom}
          onZoomOut={view.kind === 'system' ? undefined : onZoomOut}
          diff={diff}
          findings={findings}
          focusedFindingId={focusedFindingId}
          onFocusFinding={focusFinding}
          overlay={overlay}
        />
      ) : (
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
          findings={findings}
          focusedFindingId={focusedFindingId}
          onFocusFinding={focusFinding}
          overlay={overlay}
        />
      )}
      <div className="player__divider">{beforeControls}</div>
      <PlaybackControls
        steps={steps}
        playback={playback}
        highlights={highlights}
        alts={alts}
        onChooseBranch={chooseBranch}
      />
    </div>
  );
}

function askKey(target: AskTarget): string {
  return target.kind === 'node' ? `node:${target.node.id}` : `edge:${target.edge.id}`;
}
