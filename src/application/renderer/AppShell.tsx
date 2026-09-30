import { type JSX, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { type AppInfo, appInfoChannel } from '@/application/ipc/channels';
import { type FlowEdge, type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { invokeChannel } from '@/common/renderer/ipc';
import { useAgent } from '@/features/agent';
import { analysisTitle, findingsForFlow, useAnalyses } from '@/features/analysis';
import { DockLayout, DockResizeHandle, DockToggles, useDock, ViewsMenu } from '@/features/layout';
import { useSetup } from '@/features/mcp';
import { RepoMenu, useRepo } from '@/features/repo';
import { useTabTitle } from './AppTabsContext';
import { type PanelId, usePanels } from './panels';
import { ThemeSelect } from './ThemeSelect';
import { useWindowBar } from './WindowBarContext';
import { Workspace } from './Workspace';

/**
 * En appfliks fönster: huvudytan i mitten med dockorna runt och fönsterradens
 * knappar. Tillståndet som delas mellan grafen och panelerna bor här.
 */
export function AppShell({ active }: { active: boolean }): JSX.Element {
  const windowBar = useWindowBar();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const { repo } = useRepo();
  const { analyses, current, select } = useAnalyses();
  const { layout, reveal } = useDock();
  const agent = useAgent();
  const { showGuide, agent: agentKind } = useSetup();
  // Koden för steget som spelas eller klickats i grafen, visas i panelen Kod.
  const [source, setSource] = useState<SourceRef | null>(null);
  // Valt fynd taggas med analysen. Räknaren låter samma fynd fokuseras igen.
  const [focused, setFocused] = useState<{ analysisId: string; findingId: string } | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const focusedFindingId =
    focused !== null && focused.analysisId === current?.id ? focused.findingId : null;
  const flow = current?.kind === 'flow' ? current : null;
  const findings = flow ? findingsForFlow(analyses, flow.name) : [];

  const focusFinding = useCallback(
    (analysisId: string, findingId: string | null) => {
      if (findingId === null) {
        setFocused(null);
        return;
      }
      if (analysisId !== current?.id) select(analysisId);
      setFocused({ analysisId, findingId });
      setFocusSeq((n) => n + 1);
      reveal('flowReview' satisfies PanelId);
    },
    [current, select, reveal],
  );
  const onFocusInCurrent = useCallback(
    (findingId: string | null) => {
      if (current) focusFinding(current.id, findingId);
    },
    [current, focusFinding],
  );
  const onActiveEdgeChange = useCallback((edge: FlowEdge | null) => {
    setSource(edge?.source ?? null);
  }, []);
  // Frågor från grafen går till agenten appen kör i bakgrunden.
  const onAsk = useCallback(
    (prompt: string) => {
      agent.ask(prompt);
      reveal('agent' satisfies PanelId);
    },
    [agent, reveal],
  );

  // Planer från dokument och reviewer startar en egen konversation, så de inte blandas med en analys.
  const onSendToAgent = useCallback(
    (text: string) => {
      agent.askNew(text, 'general');
      reveal('agent' satisfies PanelId);
    },
    [agent, reveal],
  );

  const panels = usePanels({
    flow,
    findings,
    source: flow ? source : null,
    focusedFindingId,
    onFocusFinding: onFocusInCurrent,
  });

  useTabTitle(repo ? (current ? `${repo.name} · ${analysisTitle(current)}` : repo.name) : null);

  useEffect(() => {
    void invokeChannel(appInfoChannel, undefined).then((value) => {
      setInfo(value);
      document.documentElement.dataset.platform = value.platform;
    });
  }, []);

  return (
    <>
      {active &&
        windowBar &&
        createPortal(
          <div className="shell__window-items">
            <RepoMenu />
            <ViewsMenu panels={panels} />
            <ThemeSelect />
            <DockToggles />
          </div>,
          windowBar,
        )}
      <div className="shell">
        <DockLayout panels={panels}>
          <Workspace
            analysis={current}
            analyses={analyses}
            findings={findings}
            onOpenFlow={select}
            hasRepo={repo !== null}
            onAsk={onAsk}
            onActiveEdgeChange={onActiveEdgeChange}
            onSelectSource={setSource}
            focusedFindingId={focusedFindingId}
            focusSeq={focusSeq}
            onFocusFinding={onFocusInCurrent}
            onFocusFindingIn={focusFinding}
            beforeControls={layout.bottom.open ? <DockResizeHandle side="bottom" /> : null}
            onSendToAgent={agentKind === 'manual' ? undefined : onSendToAgent}
          />
        </DockLayout>

        <footer className="shell__footer">
          <span className="shell__footer-tools">
            <span className="shell__version">{info ? `v${info.version}` : t('app.starting')}</span>
            {repo?.isGit && (
              <span className="shell__current-branch" title={repo.branch ?? t('repo.detachedHead')}>
                <Icon name="branch" size="sm" />
                <span>{repo.branch ?? t('repo.detachedHead')}</span>
              </span>
            )}
          </span>
          <button
            type="button"
            className="text-button"
            title={t('app.guideHint')}
            onClick={showGuide}
          >
            <Icon name="info" size="sm" /> {t('app.guide')}
          </button>
        </footer>
      </div>
    </>
  );
}
