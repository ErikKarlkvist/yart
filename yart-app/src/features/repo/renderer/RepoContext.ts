import { createContext, useContext } from 'react';
import { type RepoState } from './hooks/useRepoState';

export const RepoContext = createContext<RepoState | null>(null);

export function useRepo(): RepoState {
  const state = useContext(RepoContext);
  if (!state) throw new Error('useRepo must be used inside RepoProvider');
  return state;
}
