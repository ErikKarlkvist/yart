import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { addTodoFlow } from '@/common/model/fixtures';
import { type McpActivity } from '../model/mcp';
import { type McpDeps, type McpServerHandle, startMcpServer } from './server';

interface Delivered {
  kind: string;
  name: string;
  content: unknown;
  client: string;
}

/** Texten i ett verktygssvar. */
function textOf(result: unknown): string {
  const content = (result as { content: { text?: string }[] }).content;
  return content.map((c) => c.text ?? '').join('\n');
}

function fakeDeps(activity: McpActivity[], delivered: Delivered[]): McpDeps {
  return {
    version: '0.0.0',
    skill: () => '# Guide',
    listRepos: () => Promise.resolve([{ path: '/repo', name: 'repo', branch: 'main' }]),
    resolveRepo: (path) => Promise.resolve(path === '/repo' ? '/repo' : null),
    listAnalyses: () =>
      Promise.resolve([{ name: 'add-todo', kind: 'flow', title: 'Add todo', summary: 'Adds.' }]),
    getAnalysis: (_repo, kind, name) =>
      Promise.resolve(kind === 'flow' && name === 'add-todo' ? { flow: addTodoFlow } : null),
    deliver: (_repo, kind, name, content, via) => {
      delivered.push({ kind, name, content, client: via.client });
      if (name === 'bad') return Promise.resolve({ ok: false, errors: ['nope.ts does not exist'] });
      return Promise.resolve({ ok: true, title: 'Add todo', changed: name !== 'same' });
    },
    onActivity: (entry) => activity.push(entry),
  };
}

describe('startMcpServer', () => {
  let handle: McpServerHandle;
  let client: Client;
  const activity: McpActivity[] = [];
  const delivered: Delivered[] = [];

  beforeEach(async () => {
    activity.length = 0;
    delivered.length = 0;
    handle = await startMcpServer(fakeDeps(activity, delivered), { ports: [0] });
    client = new Client({ name: 'test-client', version: '1' });
    // Samma typglapp som i servern: transportens valfria fält saknar undefined
    await client.connect(new StreamableHTTPClientTransport(new URL(handle.url)) as Transport);
  });

  afterEach(async () => {
    await client.close();
    await handle.close();
  });

  it('lyssnar på loopback och räknar sessioner', () => {
    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}/mcp`);
    expect(handle.sessions()).toBe(1);
  });

  it('visar verktygen med flödesschemat som JSON-schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_analysis',
      'list_analyses',
      'list_repos',
      'save_document',
      'save_flow',
      'save_review',
    ]);
    const save = tools.find((tool) => tool.name === 'save_flow');
    expect(JSON.stringify(save?.inputSchema)).toContain('"steps"');
    expect(JSON.stringify(save?.inputSchema)).toContain('git rev-parse');
  });

  it('serverar guiden som resurs', async () => {
    const { contents } = await client.readResource({ uri: 'reverik://guide' });
    expect(contents[0]).toMatchObject({ text: '# Guide' });
  });

  it('sparar ett flöde och loggar vem som gjorde det', async () => {
    const result = await client.callTool({
      name: 'save_flow',
      arguments: { repo: '/repo', name: 'add-todo', flow: addTodoFlow },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Saved flow "add-todo"');
    expect(delivered).toEqual([
      { kind: 'flow', name: 'add-todo', content: { flow: addTodoFlow }, client: 'test-client' },
    ]);
    expect(activity).toEqual([
      expect.objectContaining({
        tool: 'save_flow',
        client: 'test-client',
        repoPath: '/repo',
        ok: true,
      }),
    ]);
  });

  it('skickar med jämförelsen när flödet beskriver en ändring', async () => {
    const compare = { baseLabel: 'main', headLabel: 'feature/x', base: addTodoFlow };
    const result = await client.callTool({
      name: 'save_flow',
      arguments: { repo: '/repo', name: 'add-todo', flow: addTodoFlow, compare },
    });
    expect(result.isError).toBeFalsy();
    expect(delivered[0]?.content).toEqual({ flow: addTodoFlow, compare });
  });

  it('svarar med felen när Reverik avvisar innehållet', async () => {
    const result = await client.callTool({
      name: 'save_flow',
      arguments: { repo: '/repo', name: 'bad', flow: addTodoFlow },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('nope.ts does not exist');
    expect(activity[0]).toMatchObject({ ok: false });
  });

  it('avvisar ett flöde som bryter mot schemat innan det når appen', async () => {
    const result = await client.callTool({
      name: 'save_flow',
      arguments: { repo: '/repo', name: 'add-todo', flow: { ...addTodoFlow, steps: [] } },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('flow.steps');
    expect(delivered).toEqual([]);
  });

  it('kräver att repot är en mapp', async () => {
    const result = await client.callTool({
      name: 'list_analyses',
      arguments: { repo: '/nowhere' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('/nowhere is not a directory');
  });

  it('listar och läser analyser', async () => {
    const list = await client.callTool({ name: 'list_analyses', arguments: { repo: '/repo' } });
    expect(textOf(list)).toContain('"add-todo"');
    const one = await client.callTool({
      name: 'get_analysis',
      arguments: { repo: '/repo', kind: 'flow', name: 'add-todo' },
    });
    expect(textOf(one)).toContain(addTodoFlow.title);
    const missing = await client.callTool({
      name: 'get_analysis',
      arguments: { repo: '/repo', kind: 'document', name: 'nothing' },
    });
    expect(missing.isError).toBe(true);
  });

  it('svarar 404 utanför MCP-sökvägen', async () => {
    const response = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(response.status).toBe(404);
  });

  it('frågar användaren om lov åt appens egen agent, men visar inte verktyget för andra', async () => {
    const asked: { conversationId: string; tool: string }[] = [];
    const named: { conversationId: string; title: string }[] = [];
    const approving = await startMcpServer(
      {
        ...fakeDeps(activity, delivered),
        nameConversation: (conversationId, title) => {
          named.push({ conversationId, title });
          return Promise.resolve();
        },
        requestApproval: (conversationId, request) => {
          asked.push({ conversationId, tool: request.tool });
          return Promise.resolve(
            request.tool === 'Bash' ? { allow: true } : { allow: false, message: 'No.' },
          );
        },
      },
      { ports: [0] },
    );
    const own = new Client({ name: 'claude-code', version: '1' });
    await own.connect(
      new StreamableHTTPClientTransport(
        new URL(`${approving.url}?conversation=c1&permissions=1`),
      ) as Transport,
    );
    try {
      const allowed = await own.callTool({
        name: 'permission_prompt',
        arguments: { tool_name: 'Bash', input: { command: 'npm test' } },
      });
      expect(JSON.parse(textOf(allowed))).toEqual({
        behavior: 'allow',
        updatedInput: { command: 'npm test' },
      });
      const denied = await own.callTool({
        name: 'permission_prompt',
        arguments: { tool_name: 'Edit', input: { file_path: 'a.ts' } },
      });
      expect(JSON.parse(textOf(denied))).toEqual({ behavior: 'deny', message: 'No.' });
      expect(asked).toEqual([
        { conversationId: 'c1', tool: 'Bash' },
        { conversationId: 'c1', tool: 'Edit' },
      ]);
      await own.callTool({ name: 'name_conversation', arguments: { title: 'Plan due dates' } });
      expect(named).toEqual([{ conversationId: 'c1', title: 'Plan due dates' }]);
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).not.toContain('permission_prompt');
      expect(tools.map((tool) => tool.name)).not.toContain('name_conversation');
    } finally {
      await own.close();
      await approving.close();
    }
  });
});
