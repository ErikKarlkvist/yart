import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, Menu } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { registerApplicationHandlers } from './handlers';
import { createMainWindow } from './window';
import icon from '../../../resources/icon.png?asset';
import { APP_NAME } from '@/common/model/brand';

// Preserve the existing settings and reviews directory when the display name changes.
const userDataPath = app.getPath('userData');
// Appen hette Reverik; flytta den gamla datamappen en gång så analyser och inställningar följer med.
const legacyUserDataPath = join(app.getPath('appData'), 'reverik');
if (!existsSync(userDataPath) && existsSync(legacyUserDataPath)) {
  renameSync(legacyUserDataPath, userDataPath);
}
app.setName(APP_NAME);
mkdirSync(userDataPath, { recursive: true });
app.setPath('userData', userDataPath);

// Sätt YART_USER_DATA för att köra en instans med egen datamapp, t.ex. vid felsökning
// parallellt med en annan instans.
if (process.env.YART_USER_DATA) app.setPath('userData', process.env.YART_USER_DATA);

// Sätt YART_DEBUG_PORT för att kunna styra renderern via Chrome DevTools-protokollet.
if (process.env.YART_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.YART_DEBUG_PORT);
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('se.karlkvist.yart');
  // Under utveckling är det Electrons egen app som körs, så Dock-ikonen sätts här
  if (process.platform === 'darwin') app.dock?.setIcon(icon);
  if (process.platform === 'win32') Menu.setApplicationMenu(null);
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerApplicationHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
