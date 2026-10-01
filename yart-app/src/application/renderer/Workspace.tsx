import { type JSX, type ReactNode } from 'react';
import { type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type ReviewFinding } from '@/common/model/review';
import {
  DocumentView,
  ReviewView,
  type SavedAnalysis,
  type SavedFlowAnalysis,
} from '@/features/analysis';
import { FlowPlayer } from '@/features/flow-graph';

interface Props {
  analysis: SavedAnalysis | null;
  analyses: readonly SavedAnalysis[];
  /** Fynden som pekar på det valda flödet */
  findings: readonly ReviewFinding[];
  onOpenFlow: (id: string) => void;
  hasRepo: boolean;
  onAsk: (prompt: string) => void;
  onActiveEdgeChange: (edge: FlowEdge | null) => void;
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
  analyses,
  findings,
  onOpenFlow,
  hasRepo,
  onAsk,
  onActiveEdgeChange,
  onSelectSource,
  focusedFindingId,
  focusSeq,
  onFocusFinding,
  onFocusFindingIn,
  beforeControls,
  onSendToAgent,
}: Props): JSX.Element {
  const relatedFlows = analyses.filter((item): item is SavedFlowAnalysis => item.kind === 'flow');

  return (
    <main className="workspace">
      {analysis?.kind === 'flow' ? (
        <FlowPlayer
          key={analysis.id}
          flow={analysis.flow}
          onActiveEdgeChange={onActiveEdgeChange}
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
          onOpenFinding={onFocusFindingIn}
          onSendToAgent={onSendToAgent}
        />
      ) : (
        <p className="shell__empty">{hasRepo ? t('app.chooseAnalysis') : t('app.chooseRepo')}</p>
      )}
    </main>
  );
}
