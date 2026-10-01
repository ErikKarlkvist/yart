import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { type IpcBridge } from '@/common/ipc/bridge';

const api: IpcBridge = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (event, listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => {
      listener(payload);
    };
    ipcRenderer.on(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
