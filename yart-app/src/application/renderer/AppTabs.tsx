import { type JSX, useCallback, useMemo, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { readStoredJson, StorageScopeContext, writeStored } from '@/common/renderer/storage';
import { AgentProvider } from '@/features/agent';
import { AnalysisProvider } from '@/features/analysis';
import { useSetup } from '@/features/mcp';
import { RepoProvider, useRepo } from '@/features/repo';
import { AppShell } from './AppShell';
import { AppTabsContext } from './AppTabsContext';
import { WindowBarContext } from './WindowBarContext';

interface TabsState {
  ids: number[];
  active: number;
  next: number;
}

const TABS_KEY = 'yart.tabs';
const FRESH: TabsState = { ids: [1], active: 1, next: 2 };

function isTabsState(value: unknown): value is TabsState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<TabsState>;
  return (
    Array.isArray(v.ids) &&
    v.ids.length > 0 &&
    v.ids.every((id: unknown) => typeof id === 'number') &&
    typeof v.active === 'number' &&
    typeof v.next === 'number'
  );
}

/**
 * Appen i flikar. Varje flik är ett eget fönster med eget repo, egna brancher
 * och egen analys. Alla hålls monterade så uppspelningar och val behålls.
 * Flikarna sparas och återtas vid start, deras innehåll via flikens eget
 * lagringsprefix.
 */
export function AppTabs(): JSX.Element {
  const [tabs, setTabs] = useState<TabsState>(() => readStoredJson(TABS_KEY, isTabsState) ?? FRESH);
  const [titles, setTitles] = useState<ReadonlyMap<number, string>>(() => new Map());
  const [windowActions, setWindowActions] = useState<HTMLDivElement | null>(null);

  const update = useCallback((next: (current: TabsState) => TabsState) => {
    setTabs((current) => {
      const result = next(current);
      writeStored(TABS_KEY, JSON.stringify(result));
      return result;
    });
  }, []);
  const add = useCallback(() => {
    update((s) => ({ ids: [...s.ids, s.next], active: s.next, next: s.next + 1 }));
  }, [update]);
  const close = useCallback(
    (id: number) => {
      update((s) => {
        if (s.ids.length <= 1) return s;
        const index = s.ids.indexOf(id);
        const ids = s.ids.filter((x) => x !== id);
        const active = s.active === id ? (ids[Math.max(0, index - 1)] ?? s.active) : s.active;
        return { ...s, ids, active };
      });
    },
    [update],
  );
  const activate = useCallback(
    (id: number) => {
      update((s) => ({ ...s, active: id }));
    },
    [update],
  );
  const setTitle = useCallback((id: number, title: string | null) => {
    setTitles((current) => {
      if ((current.get(id) ?? null) === title) return current;
      const next = new Map(current);
      if (title === null) next.delete(id);
      else next.set(id, title);
      return next;
    });
  }, []);

  return (
    <div className="app">
      <div className="tab-strip app__tabs">
        <div className="app__tab-list" role="tablist">
          {tabs.ids.map((id) => {
            const active = id === tabs.active;
            return (
              <div key={id} className={`tab${active ? ' is-active' : ''}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="tab__open"
                  onClick={() => {
                    activate(id);
                  }}
                >
                  {titles.get(id) ?? t('tabs.empty')}
                </button>
                {tabs.ids.length > 1 && (
                  <button
                    type="button"
                    className="tab__close"
                    title={t('tabs.close')}
                    aria-label={t('tabs.close')}
                    onClick={() => {
                      close(id);
                    }}
                  >
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="icon-button icon-button--quiet tab__add"
            title={t('tabs.new')}
            aria-label={t('tabs.new')}
            onClick={add}
          >
            <Icon name="plus" size="sm" />
          </button>
        </div>
        <span className="app__tab-spacer" />
        <div className="app__window-actions" ref={setWindowActions} />
      </div>
      <div className="app__windows">
        <WindowBarContext.Provider value={windowActions}>
          {tabs.ids.map((id) => (
            <TabWindow key={id} id={id} active={id === tabs.active} onTitle={setTitle} />
          ))}
        </WindowBarContext.Provider>
      </div>
    </div>
  );
}

interface TabWindowProps {
  id: number;
  active: boolean;
  onTitle: (id: number, title: string | null) => void;
}

/** En fliks hela app, med egna providers och eget lagringsprefix. */
function TabWindow({ id, active, onTitle }: TabWindowProps): JSX.Element {
  const scope = `yart.tab:${id}.`;
  const titleApi = useMemo(
    () => ({
      setTitle: (title: string | null) => {
        onTitle(id, title);
      },
    }),
    [id, onTitle],
  );
  return (
    <div className={`app-window${active ? ' is-active' : ''}`}>
      <StorageScopeContext.Provider value={scope}>
        <AppTabsContext.Provider value={titleApi}>
          <RepoProvider>
            <Providers>
              <AppShell active={active} />
            </Providers>
          </RepoProvider>
        </AppTabsContext.Provider>
      </StorageScopeContext.Provider>
    </div>
  );
}

/** Providers som beror på valt repo. */
function Providers({ children }: { children: JSX.Element }): JSX.Element {
  const { repo } = useRepo();
  const { agent, permission, models, efforts } = useSetup();
  return (
    <AnalysisProvider repoPath={repo?.path ?? null}>
      <AgentProvider
        repoPath={repo?.path ?? null}
        agent={agent}
        permission={permission}
        models={models}
        efforts={efforts}
      >
        {children}
      </AgentProvider>
    </AnalysisProvider>
  );
}
