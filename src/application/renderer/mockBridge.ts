import { type IpcBridge } from '@/common/ipc/bridge';
import { DEMO_REPO_RELATIVE_PATH, demoAnalyses } from '@/common/model/fixtures';
import { t } from '@/common/model/i18n';

/**
 * Ersätter preload-bryggan när renderern körs i en vanlig webbläsare under
 * utveckling, t.ex. för att titta på UI:t utan Electron. Laddas bara i dev
 * och bara om `window.api` saknas. Svarar med demo-repot och fixturerna.
 */
export function installMockBridge(): void {
  const demoPath = `/mock/${DEMO_REPO_RELATIVE_PATH}`;
  const demoRepo = {
    path: demoPath,
    name: 'todo-app',
    isGit: true,
    branch: 'main',
    origin: null,
    fileCount: 26,
    languages: [
      { name: 'TypeScript', files: 18 },
      { name: 'JSON', files: 4 },
    ],
    lastOpenedAt: new Date().toISOString(),
  };
  const builtin = demoAnalyses.map(({ flow, review }, i) => ({
    id: `builtin:${i}`,
    repoPath: demoPath,
    origin: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    kind: 'flow',
    flow,
    ...(review ? { review } : {}),
  }));
  let recent: (typeof demoRepo)[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emit = (event: string, payload: unknown): void => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const shell = new MockShell(emit);

  const handlers: Record<string, (payload: unknown) => unknown> = {
    'app:info': () => ({ version: 'mock', electron: t('app.mockElectron'), platform: 'web' }),
    'repo:list-recent': () => recent,
    'repo:pick-local': () => null,
    'repo:open-demo': () => {
      recent = [demoRepo];
      return demoRepo;
    },
    'repo:open': () => demoRepo,
    'repo:list-branches': () => ({
      current: demoRepo.branch,
      branches: ['main', 'develop', 'feature/todo-lists'],
    }),
    'repo:fetch': () => ({ ...demoRepo }),
    'repo:forget': () => {
      recent = [];
      return recent;
    },
    'analysis:list': (payload) =>
      (payload as { repoPath: string }).repoPath === demoPath ? builtin : [],
    'analysis:delete': () => builtin,
    'analysis:watch': () => undefined,
    'terminal:open': (payload) => ({ id: shell.open(payload as { repoPath: string }) }),
    'terminal:write': (payload) => {
      shell.write(payload as { id: string; data: string });
    },
    'terminal:resize': () => undefined,
    'terminal:close': () => undefined,
    'repo:read-source': async (payload) => {
      const {
        file,
        line,
        context = 8,
      } = payload as { file: string; line: number; context?: number };
      // ?raw ger filen som en ES-modul med texten som default-export, annars transpilerar Vite tsx.
      const url = `/@fs${__REVERIK_ROOT__}/${DEMO_REPO_RELATIVE_PATH}/${file}?raw`;
      const module = (await import(/* @vite-ignore */ url)) as { default: string };
      const all = module.default.split('\n');
      const startLine = Math.max(1, line - context);
      const endLine = Math.min(all.length, line + context);
      return { file, line, startLine, lines: all.slice(startLine - 1, endLine) };
    },
  };

  const api: IpcBridge = {
    invoke: (channel, payload) => {
      const handler = handlers[channel];
      if (!handler) return Promise.reject(new Error(t('error.mockChannel', { channel })));
      return Promise.resolve(handler(payload));
    },
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return () => {
        set.delete(listener);
      };
    },
  };
  window.api = api;
  console.warn(t('app.mockBridge'));
}

/**
 * Ett låtsasskal för webbläsaren: ekar det man skriver och svarar på Enter med
 * en ny prompt. Räcker för att titta på terminalpanelen utan Electron.
 */
class MockShell {
  private counter = 0;
  private lines = new Map<string, string>();

  constructor(private readonly emit: (event: string, payload: unknown) => void) {}

  open({ repoPath }: { repoPath: string }): string {
    const id = `mock-${++this.counter}`;
    this.lines.set(id, '');
    setTimeout(() => {
      this.emit('terminal:data', { id, data: `${t('app.mockShell')}\r\n${prompt(repoPath)}` });
    }, 50);
    return id;
  }

  write({ id, data }: { id: string; data: string }): void {
    const line = this.lines.get(id) ?? '';
    for (const ch of data) {
      if (ch === '\r') {
        this.emit('terminal:data', { id, data: `\r\n${line ? `${line}\r\n` : ''}${prompt()}` });
        this.lines.set(id, '');
      } else if (ch === '\u007f') {
        if (line.length > 0) {
          this.lines.set(id, line.slice(0, -1));
          this.emit('terminal:data', { id, data: '\b \b' });
        }
      } else if (ch >= ' ') {
        this.lines.set(id, (this.lines.get(id) ?? '') + ch);
        this.emit('terminal:data', { id, data: ch });
      }
    }
  }
}

function prompt(cwd = '~/todo-app'): string {
  return `\u001b[1;34m${cwd.split('/').pop() ?? cwd}\u001b[0m $ `;
}
