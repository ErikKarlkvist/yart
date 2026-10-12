import { defineChannel } from '@/common/ipc/channel';
import { type FileDiff } from '../model/diff';

/**
 * Diffen mellan två referenser i repot, som `git diff base...head`: det head
 * ändrat sedan grenarna skildes åt. Referenserna är det reviewn anger, commit
 * när den finns och annars etiketten.
 */
export const readDiffChannel = defineChannel<
  { repoPath: string; base: string; head: string },
  FileDiff[]
>('changes:read-diff');
