import { type JSX, useCallback, useState } from 'react';
import { type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { Splitter } from '@/common/renderer/Splitter';
import {
  DocumentView,
  InboxLog,
  type SavedAnalysis,
  type SavedFlowAnalysis,
} from '@/features/analysis';
import { FlowPlayer, FlowSummary, ReviewPanel } from '@/features/flow-graph';
import { SourceView } from '@/features/repo';

type PanelTab = 'code' | 'summary' | 'review' | 'log';

const TAB_LABELS: Readonly<Record<PanelTab, string>> = {
  code: t('panel.code'),
  summary: t('panel.summary'),
  review: t('panel.review'),
  log: t('panel.log'),
};

interface Props {
  analysis: SavedAnalysis | null;
  analyses: readonly SavedAnalysis[];
  onOpenFlow: (id: string) => void;
  hasRepo: boolean;
  logOpen: boolean;
  bottomHeight: number;
  onBottomResize: (size: number) => void;
  onLogOpenChange: (open: boolean) => void;
  onAsk: (prompt: string) => void;
  /** Valt fynd, ägs av skalet så Full review kan sätta det */
  focusedFindingId: string | null;
  /** Räknas upp vid varje fokusering, så samma fynd kan fokuseras igen */
  focusSeq: number;
  onFocusFinding: (findingId: string | null) => void;
}

/** Arbetsytan: grafen och den nedre panelen för den valda analysen. */
export function Workspace({
  analysis,
  analyses,
  onOpenFlow,
  hasRepo,
  logOpen,
  bottomHeight,
  onBottomResize,
  onLogOpenChange,
  onAsk,
  focusedFindingId,
  focusSeq,
  onFocusFinding,
}: Props): JSX.Element {
  const [source, setSource] = useState<SourceRef | null>(null);
  // Fliken följer fokuseringen: ett nytt fynd visar Review tills användaren väljer en annan flik.
  const [tabChoice, setTabChoice] = useState<{ tab: PanelTab; seq: number }>({
    tab: 'code',
    seq: 0,
  });
  const tab: PanelTab =
    focusedFindingId !== null && tabChoice.seq !== focusSeq ? 'review' : tabChoice.tab;
  const setTab = useCallback(
    (next: PanelTab) => {
      setTabChoice({ tab: next, seq: focusSeq });
    },
    [focusSeq],
  );

  const onActiveEdgeChange = useCallback((edge: FlowEdge | null) => {
    setSource(edge?.source ?? null);
  }, []);
  const onSelectSource = useCallback((selected: SourceRef) => {
    setSource(selected);
  }, []);

  const flowAnalysis = analysis?.kind === 'flow' ? analysis : null;
  const documentAnalysis = analysis?.kind === 'document' ? analysis : null;
  const relatedFlows = analyses.filter((item): item is SavedFlowAnalysis => item.kind === 'flow');
  const shownSource = flowAnalysis ? source : null;
  // Flikar utan innehåll faller tillbaka: dokument visar sin text i arbetsytan.
  const enabled: Record<PanelTab, boolean> = {
    code: shownSource !== null,
    summary: flowAnalysis !== null,
    review: flowAnalysis?.review !== undefined,
    log: true,
  };
  const activeTab: PanelTab = enabled[tab]
    ? tab
    : tab === 'code' && enabled.review
      ? 'review'
      : tab === 'code' && enabled.summary
        ? 'summary'
        : 'log';

  const splitter = (
    <Splitter
      orientation="horizontal"
      size={bottomHeight}
      min={120}
      max={700}
      inverted
      onResize={onBottomResize}
      label={t('panel.resizeBottom')}
    />
  );

  return (
    <div className="workspace" style={{ '--bottom-height': `${bottomHeight}px` }}>
      <main className="workspace__canvas">
        {flowAnalysis ? (
          <FlowPlayer
            key={flowAnalysis.id}
            flow={flowAnalysis.flow}
            onActiveEdgeChange={onActiveEdgeChange}
            onSelectSource={onSelectSource}
            flowFile={flowAnalysis.file}
            onAsk={onAsk}
            review={flowAnalysis.review}
            focusedFindingId={focusedFindingId}
            focusSeq={focusSeq}
            onFocusFinding={onFocusFinding}
            beforeControls={logOpen ? splitter : null}
          />
        ) : documentAnalysis ? (
          <DocumentView analysis={documentAnalysis} flows={relatedFlows} onOpenFlow={onOpenFlow} />
        ) : (
          <p className="shell__empty">{hasRepo ? t('app.chooseAnalysis') : t('app.chooseRepo')}</p>
        )}
      </main>

      {logOpen && (
        <section className="workspace__bottom">
          {splitter}
          <div className="shell__panel-bar">
            <div className="shell__tabs" role="tablist">
              {(Object.keys(TAB_LABELS) as PanelTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`shell__tab${activeTab === key ? ' is-active' : ''}`}
                  disabled={!enabled[key]}
                  onClick={() => {
                    setTab(key);
                  }}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-button"
              title={t('panel.minimise')}
              aria-label={t('panel.minimise')}
              onClick={() => {
                onLogOpenChange(false);
              }}
            >
              <Icon name="chevronDown" />
            </button>
          </div>
          {activeTab === 'code' && shownSource ? (
            <SourceView source={shownSource} commit={analysis?.ref?.commit} />
          ) : activeTab === 'summary' && flowAnalysis ? (
            <FlowSummary flow={flowAnalysis.flow} />
          ) : activeTab === 'review' && flowAnalysis?.review ? (
            <ReviewPanel
              flow={flowAnalysis.flow}
              review={flowAnalysis.review}
              commit={flowAnalysis.ref?.commit}
              focusedFindingId={focusedFindingId}
              onFocus={onFocusFinding}
            />
          ) : (
            <InboxLog />
          )}
        </section>
      )}
    </div>
  );
}
