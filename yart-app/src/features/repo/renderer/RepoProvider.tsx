import { type JSX, type ReactNode } from 'react';
import { useRepoState } from './hooks/useRepoState';
import { RepoContext } from './RepoContext';

export function RepoProvider({ children }: { children: ReactNode }): JSX.Element {
  const state = useRepoState();
  return <RepoContext.Provider value={state}>{children}</RepoContext.Provider>;
}
