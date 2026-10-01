import { defineChannel } from '@/common/ipc/channel';

export interface AppInfo {
  version: string;
  electron: string;
  platform: string;
}

export const appInfoChannel = defineChannel<undefined, AppInfo>('app:info');
