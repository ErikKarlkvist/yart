import { type JSX, useCallback, useEffect, useState } from 'react';
import { type AppInfo, appInfoChannel } from '@/application/ipc/channels';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { Splitter } from '@/common/renderer/Splitter';
import { invokeChannel } from '@/common/renderer/ipc';
import { AnalysisList, analysisTitle, GUIDE_FILE, useAnalyses } from '@/features/analysis';
import { useTabTitle } from './AppTabsContext';
import { BranchBar, RepoMenu, RepoPanel, useRepo } from '@/features/repo';
import { ConnectPanel, useMcpStatus } from '@/features/mcp';
import { TerminalPanel, useTerminalApi } from '@/features/terminal';
import { ThemeSelect } from './ThemeSelect';
import { useStoredChoice, useStoredFlag, useStoredNumber } from '@/common/renderer/useStored';
import { ReviewSidebar } from './ReviewSidebar';
import { Workspace } from './Workspace';

const SIDE_MODES = ['terminal', 'review', 'connect'] as const;

export function AppShell(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const { repo } = useRepo();
  const { analyses, current, select } = useAnalyses();
  const mcp = useMcpStatus();
  const [logOpen, setLogOpen] = useStoredFlag('reverik.logOpen', true);
  // En ny appstart börjar med arbetsytan. Varje flik håller sedan sitt eget öppet/stängt-läge.
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sideMode, setSideMode] = useStoredChoice('reverik.sideMode', SIDE_MODES, 'terminal');
  const [sidebarWidth, setSidebarWidth] = useStoredNumber('reverik.sidebarWidth', 300);
  const [bottomHeight, setBottomHeight] = useStoredNumber('reverik.bottomHeight', 220);
  const [terminalWidth, setTerminalWidth] = useStoredNumber('reverik.terminalWidth', 460);
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

  const hideTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, [setTerminalOpen]);
  // Frågor från grafen går till agenten i terminalen. Är panelen stängd öppnas den och frågan köas.
  const terminal = useTerminalApi();
  const onAsk = useCallback(
    (prompt: string) => {
      setTerminalOpen(true);
      setSideMode('terminal');
      terminal.send(prompt);
    },
    [terminal, setTerminalOpen, setSideMode],
  );
  const onRunReview = useCallback(
    (base: string, head: string) => {
      onAsk(t('branch.reviewPrompt', { base, head }));
    },
    [onAsk],
  );

  const shellClass = [
    'shell',
    logOpen ? '' : 'shell--log-closed',
    terminalOpen ? '' : 'shell--terminal-closed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={shellClass}
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
        '--terminal-width': `${terminalWidth}px`,
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

      {terminalOpen && (
        <div className="shell__side">
          <Splitter
            orientation="vertical"
            size={terminalWidth}
            min={320}
            max={900}
            inverted
            edge="start"
            onResize={setTerminalWidth}
            label={t('panel.resizeTerminal')}
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
          </div>
          <div className="shell__side-body">
            {/* Terminalen hålls monterad i reviewläget så agenten kör vidare */}
            <div className={`shell__side-pane${sideMode === 'terminal' ? ' is-active' : ''}`}>
              <TerminalPanel
                repoPath={repo?.path ?? null}
                repoName={repo?.name ?? ''}
                guideFile={GUIDE_FILE}
                onHide={hideTerminal}
              />
            </div>
            <div className={`shell__side-pane${sideMode === 'review' ? ' is-active' : ''}`}>
              <ReviewSidebar onFocus={focusFinding} />
            </div>
            <div className={`shell__side-pane${sideMode === 'connect' ? ' is-active' : ''}`}>
              <ConnectPanel status={mcp.status} onInstallSkill={mcp.installSkill} />
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
          <button
            type="button"
            className="text-button"
            title={t('app.mcpHint')}
            onClick={() => {
              setSideMode('connect');
              setTerminalOpen(true);
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
          {!terminalOpen && (
            <button
              type="button"
              className="text-button"
              title={t('panel.showTerminal')}
              onClick={() => {
                setSideMode('terminal');
                setTerminalOpen(true);
              }}
            >
              <Icon name="play" size="sm" /> {t('panel.showTerminal')}
            </button>
          )}
          <ThemeSelect />
        </span>
      </footer>
    </div>
  );
}
