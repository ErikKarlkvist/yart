import { type JSX, useCallback, useEffect, useState } from 'react';
import { type AppInfo, appInfoChannel } from '@/application/ipc/channels';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { Splitter } from '@/common/renderer/Splitter';
import { invokeChannel } from '@/common/renderer/ipc';
import { AnalysisList, analysisTitle, useAnalyses } from '@/features/analysis';
import { useTabTitle } from './AppTabsContext';
import { BranchBar, RepoMenu, RepoPanel, useRepo } from '@/features/repo';
import { ConnectPanel, useMcpStatus } from '@/features/mcp';
import { ThemeSelect } from './ThemeSelect';
import { useStoredChoice, useStoredFlag, useStoredNumber } from '@/common/renderer/useStored';
import { ReviewSidebar } from './ReviewSidebar';
import { Workspace } from './Workspace';

const SIDE_MODES = ['review', 'connect'] as const;
/** Hur länge kvittot på en kopierad prompt visas i sidfoten */
const COPIED_MS = 2000;

export function AppShell(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const { repo } = useRepo();
  const { analyses, current, select } = useAnalyses();
  const mcp = useMcpStatus();
  const [logOpen, setLogOpen] = useStoredFlag('reverik.logOpen', true);
  // En ny appstart börjar med arbetsytan. Varje flik håller sedan sitt eget öppet/stängt-läge.
  const [sideOpen, setSideOpen] = useState(false);
  const [sideMode, setSideMode] = useStoredChoice('reverik.sideMode', SIDE_MODES, 'review');
  // Kvitto i sidfoten när en prompt kopierats till urklipp
  const [copied, setCopied] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useStoredNumber('reverik.sidebarWidth', 300);
  const [bottomHeight, setBottomHeight] = useStoredNumber('reverik.bottomHeight', 220);
  const [sideWidth, setSideWidth] = useStoredNumber('reverik.sideWidth', 460);
  // Valt fynd taggas med analysen. Räknaren låter samma fynd fokuseras igen.
  const [focused, setFocused] = useState<{ analysisId: string; findingId: string } | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const focusedFindingId =
    focused !== null && focused.analysisId === current?.id ? focused.findingId : null;
  const focusFinding = useCallback(
    (analysisId: string, findingId: string | null) => {
      if (findingId === null) {
        setFocused(null);
        return;
      }
      if (analysisId !== current?.id) select(analysisId);
      setFocused({ analysisId, findingId });
      setFocusSeq((n) => n + 1);
      setLogOpen(true);
    },
    [current, select, setLogOpen],
  );
  const openSide = useCallback(
    (mode: (typeof SIDE_MODES)[number]) => {
      setSideMode(mode);
      setSideOpen(true);
    },
    [setSideMode],
  );
  const onFocusInCurrent = useCallback(
    (findingId: string | null) => {
      if (current) focusFinding(current.id, findingId);
    },
    [current, focusFinding],
  );
  useTabTitle(repo ? (current ? `${repo.name} · ${analysisTitle(current)}` : repo.name) : null);

  useEffect(() => {
    void invokeChannel(appInfoChannel, undefined).then(setInfo);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);
  // Appen har ingen egen agent: frågor och reviewuppdrag kopieras som färdiga
  // prompter som användaren klistrar in hos sin agent.
  const onAsk = useCallback((prompt: string) => {
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setCopied(true);
      })
      .catch(console.error);
  }, []);
  const onRunReview = useCallback(
    (base: string, head: string) => {
      onAsk(t('branch.reviewPrompt', { base, head }));
    },
    [onAsk],
  );

  const shellClass = [
    'shell',
    logOpen ? '' : 'shell--log-closed',
    sideOpen ? '' : 'shell--side-closed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={shellClass}
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
        '--side-width': `${sideWidth}px`,
      }}
    >
      <aside className="shell__sidebar">
        <div className="shell__drag" />
        <h1 className="shell__title">REVERIK</h1>
        <RepoPanel />
        <BranchBar onRunReview={onRunReview} />
        {repo && <AnalysisList />}
        <Splitter
          orientation="vertical"
          size={sidebarWidth}
          min={220}
          max={600}
          onResize={setSidebarWidth}
          label={t('panel.resizeSidebar')}
        />
      </aside>

      <div className="shell__work">
        <Workspace
          analysis={current}
          analyses={analyses}
          onOpenFlow={(id) => {
            select(id);
          }}
          hasRepo={repo !== null}
          logOpen={logOpen}
          bottomHeight={bottomHeight}
          onBottomResize={setBottomHeight}
          onLogOpenChange={setLogOpen}
          onAsk={onAsk}
          focusedFindingId={focusedFindingId}
          focusSeq={focusSeq}
          onFocusFinding={onFocusInCurrent}
          onFocusFindingIn={focusFinding}
        />
      </div>

      {sideOpen && (
        <div className="shell__side">
          <Splitter
            orientation="vertical"
            size={sideWidth}
            min={320}
            max={900}
            inverted
            edge="start"
            onResize={setSideWidth}
            label={t('panel.resizeSide')}
          />
          <div className="tab-strip shell__side-modes" role="tablist">
            {SIDE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={sideMode === mode}
                className={`tab tab--caps${sideMode === mode ? ' is-active' : ''}`}
                onClick={() => {
                  setSideMode(mode);
                }}
              >
                {t(`side.${mode}`)}
              </button>
            ))}
            <span className="shell__side-spacer" />
            <button
              type="button"
              className="icon-button icon-button--quiet"
              title={t('panel.hideSide')}
              aria-label={t('panel.hideSide')}
              onClick={() => {
                setSideOpen(false);
              }}
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
          <div className="shell__side-body">
            <div className={`shell__side-pane${sideMode === 'review' ? ' is-active' : ''}`}>
              <ReviewSidebar onFocus={focusFinding} />
            </div>
            <div className={`shell__side-pane${sideMode === 'connect' ? ' is-active' : ''}`}>
              <ConnectPanel mcp={mcp} />
            </div>
          </div>
        </div>
      )}

      <footer className="shell__footer">
        <span className="shell__footer-tools">
          <RepoMenu />
          <span>
            {info
              ? `v${info.version} · Electron ${info.electron} · ${info.platform}`
              : t('app.starting')}
          </span>
          {copied && <span className="shell__copied">{t('app.copiedPrompt')}</span>}
          <button
            type="button"
            className="text-button"
            title={t('app.mcpHint')}
            onClick={() => {
              openSide('connect');
            }}
          >
            <Icon name="link" size="sm" />{' '}
            {mcp.status?.url
              ? t('app.mcp', { url: mcp.status.url })
              : mcp.status?.error
                ? t('app.mcpFailed', { error: mcp.status.error })
                : t('app.mcpStarting')}
          </button>
        </span>
        <span className="shell__footer-tools">
          {!logOpen && (
            <button
              type="button"
              className="text-button"
              title={t('panel.show')}
              onClick={() => {
                setLogOpen(true);
              }}
            >
              <Icon name="chevronUp" size="sm" /> {t('panel.show')}
            </button>
          )}
          {!sideOpen && (
            <button
              type="button"
              className="text-button"
              title={t('panel.showSide')}
              onClick={() => {
                openSide('review');
              }}
            >
              <Icon name="warning" size="sm" /> {t('panel.showSide')}
            </button>
          )}
          <ThemeSelect />
        </span>
      </footer>
    </div>
  );
}
