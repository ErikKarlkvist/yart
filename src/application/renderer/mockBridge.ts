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
  const builtin = demoAnalyses.map((demo, i) => {
    const base = {
      id: `builtin:${i}`,
      repoPath: demoPath,
      origin: 'builtin',
      createdAt: '2026-01-01T00:00:00.000Z',
      name: demo.name,
    };
    if (demo.kind === 'review') return { ...base, kind: 'review', review: demo.review };
    return {
      ...base,
      kind: 'flow',
      flow: demo.flow,
      ...(demo.compare ? { compare: demo.compare } : {}),
    };
  });
  let recent: (typeof demoRepo)[] = [];
  // Inga händelser skickas i mock-läget, men lyssnare måste kunna registreras
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const mockMcpStatus = {
    url: 'http://127.0.0.1:7390/mcp',
    sessions: 0,
    activity: [],
    error: null,
    skills: {
      claude: { path: '/mock/home/.claude/skills/reverik/SKILL.md', state: 'missing' },
      codex: { path: '/mock/home/.codex/skills/reverik/SKILL.md', state: 'missing' },
    },
  };

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
    'mcp:status': () => mockMcpStatus,
    'mcp:install-skill': (payload) => {
      const { target } = payload as { target: 'claude' | 'codex' };
      const skills = {
        ...mockMcpStatus.skills,
        [target]: { ...mockMcpStatus.skills[target], state: 'current' },
      };
      return { ...mockMcpStatus, skills };
    },
    'mcp:skill-text': () => '# Reverik guide (mock)',
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
