import { join } from 'node:path';
import { BrowserWindow, nativeTheme, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { APP_NAME } from '@/common/model/brand';

export function createMainWindow(): BrowserWindow {
  // Appen har bara ett mörkt tema, så fönstret och systemets kontroller är alltid mörka.
  nativeTheme.themeSource = 'dark';
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0a0a',
    title: APP_NAME,
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'hiddenInset',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: '#121212',
            symbolColor: '#f2f2f2',
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
