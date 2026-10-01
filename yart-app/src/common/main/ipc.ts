import { BrowserWindow, ipcMain } from 'electron';
import { type Channel, type IpcEvent } from '@/common/ipc/channel';

export function handleChannel<Req, Res>(
  channel: Channel<Req, Res>,
  handler: (request: Req) => Promise<Res> | Res,
): void {
  ipcMain.handle(channel.name, (_event, payload: unknown) => handler(payload as Req));
}

/** Skickar en händelse till alla öppna fönster. */
export function emitEvent<Payload>(event: IpcEvent<Payload>, payload: Payload): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(event.name, payload);
  }
}
