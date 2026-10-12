import { useEffect, useState } from 'react';
import { errorMessage } from '@/common/model/json';
import { invokeChannel } from '@/common/renderer/ipc';
import { readDiffChannel } from '../../ipc/channels';
import { type FileDiff } from '../../model/diff';

export type DiffState =
  | { status: 'loading' }
  | { status: 'ready'; files: FileDiff[] }
  | { status: 'error'; message: string };

type Result = { key: string } & Exclude<DiffState, { status: 'loading' }>;

/**
 * Diffen mellan två referenser i repot. Läses om när någon av dem byts; ett
 * svar bär nyckeln det gäller, så ett gammalt svar aldrig visas för nya referenser.
 */
export function useDiff(repoPath: string | null, base: string, head: string): DiffState {
  const key = `${repoPath ?? ''}|${base}|${head}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    invokeChannel(readDiffChannel, { repoPath, base, head })
      .then((files) => {
        if (!cancelled) setResult({ key, status: 'ready', files });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key, status: 'error', message: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, base, head, key]);

  return result?.key === key ? result : { status: 'loading' };
}
