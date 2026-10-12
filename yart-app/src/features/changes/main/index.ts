import { handleChannel } from '@/common/main/ipc';
import { readDiffChannel } from '../ipc/channels';
import { readDiff } from './diff';

export function registerChangesHandlers(): void {
  handleChannel(readDiffChannel, ({ repoPath, base, head }) => readDiff(repoPath, base, head));
}
