import { isDemoRepo } from '@/common/main/demo';
import { demoAnalyses } from '@/common/model/fixtures';
import { type SavedAnalysis } from '../model/analysis';

/** Inbyggda grundanalyser. Just nu bara för demo-appen. */
export function builtinAnalyses(repoPath: string): SavedAnalysis[] {
  if (!isDemoRepo(repoPath)) return [];
  return demoAnalyses.map((demo, i) => {
    const base = {
      id: `builtin:${i}`,
      repoPath,
      origin: 'builtin' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      name: demo.name,
    };
    if (demo.kind === 'review') return { ...base, kind: 'review', review: demo.review };
    if (demo.kind === 'document') return { ...base, kind: 'document', document: demo.document };
    return {
      ...base,
      kind: 'flow',
      flow: demo.flow,
      ...(demo.compare ? { compare: demo.compare } : {}),
    };
  });
}
