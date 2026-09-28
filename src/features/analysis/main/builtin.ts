import { isDemoRepo } from '@/common/main/demo';
import { demoAnalyses } from '@/common/model/fixtures';
import { type SavedAnalysis } from '../model/analysis';

/** Inbyggda grundanalyser. Just nu bara för demo-appen. */
export function builtinAnalyses(repoPath: string): SavedAnalysis[] {
  if (!isDemoRepo(repoPath)) return [];
  return demoAnalyses.map(({ flow, review }, i) => ({
    id: `builtin:${i}`,
    repoPath,
    origin: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    kind: 'flow',
    flow,
    ...(review ? { review } : {}),
  }));
}
