// Under utveckling körs Electrons egen app, och macOS visar dess namn i Dock och
// appväxlaren. Skriptet döper om den till yart i node_modules innan `npm run dev`.
import { execFileSync } from 'node:child_process';
import { existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

const NAME = 'yart';

if (process.platform === 'darwin') {
  const app = join(import.meta.dirname, '..', 'node_modules/electron/dist/Electron.app');
  const plist = join(app, 'Contents/Info.plist');
  if (existsSync(plist)) {
    const read = (key) =>
      execFileSync('plutil', ['-extract', key, 'raw', plist], { encoding: 'utf8' }).trim();
    if (read('CFBundleName') !== NAME || read('CFBundleDisplayName') !== NAME) {
      for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
        execFileSync('plutil', ['-replace', key, '-string', NAME, plist]);
      }
      // macOS cachar namnet per app; en ny ändringstid får det att läsas om
      const now = new Date();
      utimesSync(app, now, now);
    }
  }
}
