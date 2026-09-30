import { type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type ReviewFinding } from '@/common/model/review';
import { AgentPanel } from '@/features/agent';
import { DeliveryLog, type SavedFlowAnalysis } from '@/features/analysis';
import { ReviewPanel } from '@/features/flow-graph';
import { type DockLayoutState, type DockPanel } from '@/features/layout';
import { ConnectPanel, useMcpStatus } from '@/features/mcp';
import { SourceView, useRepo } from '@/features/repo';
import { Explorer } from './Explorer';

/**
 * Alla paneler som kan dockas. En ny panel läggs till här: ett id, en plats i
 * standardlayouten och en definition i usePanels. Sparade layouter får nya
 * paneler i sin standarddocka.
 */
const PANEL_IDS = ['explorer', 'code', 'flowReview', 'log', 'agent', 'connect'] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export const DEFAULT_LAYOUT: DockLayoutState = {
  left: { panels: ['explorer'], closed: [], active: 'explorer', open: true, size: 300 },
  bottom: {
    panels: ['code', 'flowReview', 'log'],
    closed: [],
    active: 'code',
    open: true,
    size: 220,
  },
  right: {
    panels: ['agent', 'connect'],
    closed: [],
    active: 'agent',
    open: false,
    size: 460,
  },
} satisfies Record<
  string,
  { panels: PanelId[]; closed: PanelId[]; active: PanelId; open: boolean; size: number }
>;

interface PanelContext {
  /** Det valda flödet, null när en annan sorts analys eller ingen är vald */
  flow: SavedFlowAnalysis | null;
  /** Fynden som pekar på det valda flödet */
  findings: readonly ReviewFinding[];
  /** Koden för steget som spelas eller klickats, bara när ett flöde är valt */
  source: SourceRef | null;
  focusedFindingId: string | null;
  /** Fokuserar ett fynd i det valda flödet */
  onFocusFinding: (findingId: string | null) => void;
}

/** Panelerna för en appflik. Var de ligger bestäms av dockornas layout. */
export function usePanels({
  flow,
  findings,
  source,
  focusedFindingId,
  onFocusFinding,
}: PanelContext): DockPanel[] {
  const { repo } = useRepo();
  const mcp = useMcpStatus();

  const panels: Record<PanelId, Omit<DockPanel, 'id'>> = {
    explorer: {
      title: t('panel.explorer'),
      content: <Explorer hasRepo={repo !== null} />,
    },
    code: {
      title: t('panel.code'),
      available: source !== null,
      content: source && <SourceView source={source} commit={flow?.ref?.commit} />,
    },
    flowReview: {
      title: t('panel.review'),
      available: flow !== null && (flow.compare !== undefined || findings.length > 0),
      content: flow && (
        <ReviewPanel
          flow={flow.flow}
          compare={flow.compare}
          findings={findings}
          commit={flow.ref?.commit}
          focusedFindingId={focusedFindingId}
          onFocus={onFocusFinding}
        />
      ),
    },
    log: {
      title: t('panel.log'),
      content: <DeliveryLog />,
    },
    agent: {
      title: t('panel.agent'),
      fill: true,
      content: <AgentPanel hasRepo={repo !== null} />,
    },
    connect: {
      title: t('panel.connect'),
      fill: true,
      content: <ConnectPanel mcp={mcp} />,
    },
  };

  return PANEL_IDS.map((id) => ({ id, ...panels[id] }));
}
