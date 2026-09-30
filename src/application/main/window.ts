import { join } from 'node:path';
import { BrowserWindow, nativeTheme, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { APP_NAME } from '@/common/model/brand';

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: APP_NAME,
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'hiddenInset',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: nativeTheme.shouldUseDarkColors ? '#161a22' : '#ffffff',
            symbolColor: nativeTheme.shouldUseDarkColors ? '#e6e8ee' : '#1c2230',
            height: 38,
          },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
