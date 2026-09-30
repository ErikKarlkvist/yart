import { type JSX } from 'react';
import { AnalysisList } from '@/features/analysis';
import { RepoPanel } from '@/features/repo';

/** Repot och analyserna i det, det som förr var den fasta vänsterspalten */
export function Explorer({ hasRepo }: { hasRepo: boolean }): JSX.Element {
  return (
    <div className="explorer">
      <RepoPanel />
      {hasRepo && <AnalysisList />}
    </div>
  );
}
