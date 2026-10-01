import { createContext, useContext } from 'react';
import { type AnalysisState } from './hooks/useAnalysisState';

export const AnalysisContext = createContext<AnalysisState | null>(null);

export function useAnalyses(): AnalysisState {
  const state = useContext(AnalysisContext);
  if (!state) throw new Error('useAnalyses must be used inside AnalysisProvider');
  return state;
}
