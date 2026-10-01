import { type Channel, type IpcEvent } from '@/common/ipc/channel';
import '@/common/ipc/bridge';

const REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']+': (?:Error: )?/;

export async function invokeChannel<Req, Res>(
  channel: Channel<Req, Res>,
  request: Req,
): Promise<Res> {
  try {
    return (await window.api.invoke(channel.name, request)) as Res;
  } catch (error) {
    // Electron prefixar fel från main, vi vill visa det ursprungliga meddelandet.
    if (error instanceof Error)
      throw new Error(error.message.replace(REMOTE_ERROR_PREFIX, ''), { cause: error });
    throw error;
  }
}

export function subscribeEvent<Payload>(
  event: IpcEvent<Payload>,
  listener: (payload: Payload) => void,
): () => void {
  return window.api.on(event.name, (payload) => {
    listener(payload as Payload);
  });
}
