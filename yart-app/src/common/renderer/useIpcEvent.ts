import { useEffect } from 'react';
import { type IpcEvent } from '@/common/ipc/channel';
import { subscribeEvent } from './ipc';

/** Prenumererar på en main-händelse så länge komponenten lever. */
export function useIpcEvent<Payload>(
  event: IpcEvent<Payload>,
  listener: (payload: Payload) => void,
): void {
  useEffect(() => subscribeEvent(event, listener), [event, listener]);
}
