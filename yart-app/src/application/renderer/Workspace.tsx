import { type JSX, type ReactNode } from 'react';
import { type FlowEdge, type SourceRef } from '@/common/model/flow';
import { BrandMark } from '@/common/renderer/BrandMark';
import { t } from '@/common/model/i18n';
import { type ReviewFinding } from '@/common/model/review';
import {
  changesId,
  DocumentView,
  ReviewView,
  type SavedAnalysis,
  type SavedFlowAnalysis,
  type SavedReviewAnalysis,
} from '@/features/analysis';
import { ChangesView, type ReviewedFlow } from '@/features/changes';
import { type FlowPaths, FlowPlayer } from '@/features/flow-graph';

interface Props {
  analysis: SavedAnalysis | null;
  /** Reviewn vars diff är vald, när ingen analys är det */
  changes: SavedReviewAnalysis | null;
  analyses: readonly SavedAnalysis[];
  /** Fynden som pekar på det valda flödet */
  findings: readonly ReviewFinding[];
  onOpenFlow: (id: string) => void;
  hasRepo: boolean;
  onAsk: (prompt: string) => void;
  onActiveEdgeChange: (edge: FlowEdge | null) => void;
  onPathsChange: (paths: FlowPaths | null) => void;
  /** Sparar vilka system användaren fällt ut i ett flöde */
  onExpandedChange: (analysisId: string, expanded: string[]) => void;
  onSelectSource: (source: SourceRef) => void;
  /** Valt fynd, ägs av skalet så reviewdokumentet kan sätta det */
  focusedFindingId: string | null;
  /** Räknas upp vid varje fokusering, så samma fynd kan fokuseras igen */
  focusSeq: number;
  onFocusFinding: (findingId: string | null) => void;
  /** Fokuserar ett fynd i ett annat flöde, från reviewvyn */
  onFocusFindingIn: (analysisId: string, findingId: string) => void;
  /** Draghandtag mellan grafen och uppspelningen, som styr den nedre dockan */
  beforeControls: ReactNode;
  /** Skickar en plan till agenten appen kör. Saknas med extern AI. */
  onSendToAgent: ((text: string) => void) | undefined;
}

/** Huvudytan i mitten: grafen, dokumentet eller reviewn för den valda analysen. */
export function Workspace({
  analysis,
  changes,
  analyses,
  findings,
  onOpenFlow,
  hasRepo,
  onAsk,
  onActiveEdgeChange,
  onPathsChange,
  onExpandedChange,
  onSelectSource,
  focusedFindingId,
  focusSeq,
  onFocusFinding,
  onFocusFindingIn,
  beforeControls,
  onSendToAgent,
}: Props): JSX.Element {
  const relatedFlows = analyses.filter((item): item is SavedFlowAnalysis => item.kind === 'flow');
  const reviewedFlows = (review: SavedReviewAnalysis): ReviewedFlow[] =>
    review.review.flows.flatMap((name) =>
      relatedFlows
        .filter((f) => f.name === name)
        .map((f) => ({ name: f.name, title: f.flow.title, flow: f.flow, base: f.compare?.base })),
    );

  return (
    <main className="workspace">
      {changes ? (
        <ChangesView
          key={changes.id}
          review={changes.review}
          flows={reviewedFlows(changes)}
          onOpenFinding={(finding) => {
            const flow = relatedFlows.find((f) => f.name === finding.flow);
            if (flow) onFocusFindingIn(flow.id, finding.id);
          }}
        />
      ) : analysis?.kind === 'flow' ? (
        <FlowPlayer
          key={analysis.id}
          flow={analysis.flow}
          onActiveEdgeChange={onActiveEdgeChange}
          onPathsChange={onPathsChange}
          onExpandedChange={(expanded) => {
            onExpandedChange(analysis.id, expanded);
          }}
          onSelectSource={onSelectSource}
          flowName={analysis.name}
          onAsk={onAsk}
          compare={analysis.compare}
          findings={findings}
          focusedFindingId={focusedFindingId}
          focusSeq={focusSeq}
          onFocusFinding={onFocusFinding}
          beforeControls={beforeControls}
        />
      ) : analysis?.kind === 'document' ? (
        <DocumentView
          analysis={analysis}
          flows={relatedFlows}
          onOpenFlow={onOpenFlow}
          onSendToAgent={onSendToAgent}
        />
      ) : analysis?.kind === 'review' ? (
        <ReviewView
          key={analysis.id}
          analysis={analysis}
          flows={relatedFlows}
          onOpenFlow={onOpenFlow}
          onOpenChanges={() => {
            onOpenFlow(changesId(analysis.id));
          }}
          onOpenFinding={onFocusFindingIn}
          onSendToAgent={onSendToAgent}
        />
      ) : (
        <div className="workspace__empty">
          <BrandMark size="lg" />
          <p className="shell__empty">{hasRepo ? t('app.chooseAnalysis') : t('app.chooseRepo')}</p>
        </div>
      )}
    </main>
  );
}
