import { type JSX, type ReactNode } from 'react';
import { AnalysisContext } from './AnalysisContext';
import { useAnalysisState } from './hooks/useAnalysisState';

interface Props {
  repoPath: string | null;
  children: ReactNode;
}

export function AnalysisProvider({ repoPath, children }: Props): JSX.Element {
  const state = useAnalysisState(repoPath);
  return <AnalysisContext.Provider value={state}>{children}</AnalysisContext.Provider>;
}
