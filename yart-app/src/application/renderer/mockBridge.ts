import { type IpcBridge } from '@/common/ipc/bridge';
import { APP_NAME } from '@/common/model/brand';
import { DEMO_REPO_RELATIVE_PATH, demoAnalyses } from '@/common/model/fixtures';
import { t } from '@/common/model/i18n';
import { type Conversation } from '@/features/agent/model/conversation';

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
    if (demo.kind === 'document') return { ...base, kind: 'document', document: demo.document };
    return {
      ...base,
      kind: 'flow',
      flow: demo.flow,
      ...(demo.compare ? { compare: demo.compare } : {}),
    };
  });
  // Det mock-agenten sparat, med konversationen som sparade det
  let saved: Record<string, unknown>[] = [];
  let recent: (typeof demoRepo)[] = [];
  const conversations: Conversation[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emit = (event: string, payload: unknown): void => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const mockMcpStatus = {
    url: 'http://127.0.0.1:7390/mcp',
    sessions: 0,
    activity: [],
    error: null,
    skills: {
      claude: { path: '/mock/home/.claude/skills/yart/SKILL.md', state: 'missing' },
      codex: { path: '/mock/home/.codex/skills/yart/SKILL.md', state: 'missing' },
    },
  };

  const handlers: Record<string, (payload: unknown) => unknown> = {
    'app:info': () => ({ version: '0.1.0', electron: t('app.mockElectron'), platform: 'web' }),
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
      (payload as { repoPath: string }).repoPath === demoPath ? [...saved, ...builtin] : [],
    'analysis:delete': (payload) => {
      const { id } = payload as { id: string };
      saved = saved.filter((analysis) => analysis.id !== id);
      return [...saved, ...builtin];
    },
    'mcp:status': () => mockMcpStatus,
    'mcp:install-skill': (payload) => {
      const { target } = payload as { target: 'claude' | 'codex' };
      const skills = {
        ...mockMcpStatus.skills,
        [target]: { ...mockMcpStatus.skills[target], state: 'current' },
      };
      return { ...mockMcpStatus, skills };
    },
    'mcp:skill-text': () => `# ${APP_NAME} guide (mock)`,
    'agent:list-conversations': () =>
      conversations.map((item) => ({
        id: item.id,
        repoPath: item.repoPath,
        agent: item.agent,
        mode: item.mode,
        ...(item.reviewBranches ? { reviewBranches: item.reviewBranches } : {}),
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    'agent:get-conversation': (payload) =>
      conversations.find((item) => item.id === (payload as { id: string }).id) ?? null,
    'agent:create-conversation': (payload) => {
      const { repoPath, agent, mode, reviewBranches } = payload as {
        repoPath: string;
        agent: Conversation['agent'];
        mode: Conversation['mode'];
        reviewBranches?: Conversation['reviewBranches'];
      };
      const at = new Date().toISOString();
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        repoPath,
        agent,
        mode,
        ...(reviewBranches ? { reviewBranches } : {}),
        title: '',
        createdAt: at,
        updatedAt: at,
        entries: [],
        threadId: null,
      };
      conversations.unshift(conversation);
      return conversation;
    },
    // Låtsasagenten svarar med ett verktyg och en mening efter en stund
    'agent:ask': (payload) => {
      const { repoPath, prompt, conversationId } = payload as {
        repoPath: string;
        prompt: string;
        conversationId: string;
      };
      const conversation = conversations.find((item) => item.id === conversationId);
      const entry = (value: unknown): void => {
        const message = { at: new Date().toISOString(), ...(value as object) };
        if (conversation) {
          conversation.entries.push(message as Conversation['entries'][number]);
          conversation.updatedAt = message.at;
          if (
            !conversation.title &&
            value &&
            typeof value === 'object' &&
            'kind' in value &&
            value.kind === 'user'
          )
            conversation.title = prompt.slice(0, 70);
        }
        emit('agent:event', {
          type: 'entry',
          repoPath,
          conversationId,
          entry: message,
        });
      };
      entry({ kind: 'user', text: prompt });
      emit('agent:event', { type: 'state', repoPath, conversationId, state: 'busy' });
      setTimeout(() => {
        // Som en riktig agent: namnger, läser en del och sparar
        for (const name of [
          'name_conversation',
          'list_analyses',
          'Read',
          'Grep',
          'Read',
          'save_flow',
        ])
          entry({ kind: 'tool', name });
        // Namnger konversationen och sparar en kopia av ett demoflöde, taggad med den
        const title = `Analyse: ${prompt.slice(0, 40)}`;
        if (conversation) conversation.title = title;
        emit('agent:event', { type: 'title', repoPath, conversationId, title });
        const flow = demoAnalyses.find((demo) => demo.kind === 'flow');
        if (flow?.kind === 'flow') {
          const analysis = {
            id: crypto.randomUUID(),
            repoPath,
            origin: 'ai',
            createdAt: new Date().toISOString(),
            name: `mock-${String(saved.length + 1)}`,
            conversationId,
            kind: 'flow',
            flow: { ...flow.flow, title: `${flow.flow.title} (mock)` },
          };
          saved = [analysis, ...saved];
          emit('analysis:delivery', {
            type: 'imported',
            repoPath,
            via: { tool: 'save_flow', client: 'mock', conversationId },
            analysis,
            list: [...saved, ...builtin],
          });
        }
        entry({ kind: 'assistant', text: t('app.mockAgentReply') });
        emit('agent:event', { type: 'state', repoPath, conversationId, state: 'idle' });
      }, 1200);
    },
    'agent:stop': () => undefined,
    // Samma form som Claude Code svarar med på initialize
    'agent:list-models': (payload) =>
      (payload as { agent: string }).agent === 'claude'
        ? [
            {
              value: 'default',
              label: 'Default (recommended)',
              description: 'Opus 5 with 1M context',
              effortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
            },
            {
              value: 'sonnet',
              label: 'Sonnet',
              description: 'Sonnet 5 · Efficient for routine tasks',
              effortLevels: ['low', 'medium', 'high'],
            },
            { value: 'haiku', label: 'Haiku', description: 'Haiku 4.5', effortLevels: [] },
          ]
        : [],
    'agent:check': (payload) =>
      (payload as { agent: string }).agent === 'claude'
        ? { installed: true, version: '2.1.274', loggedIn: false }
        : { installed: false, version: null, loggedIn: false },
    'repo:read-source': async (payload) => {
      const {
        file,
        line,
        context = 8,
      } = payload as { file: string; line: number; context?: number };
      // ?raw ger filen som en ES-modul med texten som default-export, annars transpilerar Vite tsx.
      const url = `/@fs${__YART_ROOT__}/${DEMO_REPO_RELATIVE_PATH}/${file}?raw`;
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
