import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { type CallToolResult, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { APP_NAME } from '@/common/model/brand';
import { documentSchema } from '@/common/model/document';
import { flowSchema } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { analysisNameSchema } from '@/common/model/name';
import { flowCompareSchema, reviewSchema } from '@/common/model/review';
import { MCP_HOST, MCP_PATH, type McpActivity, mcpUrl } from '../model/mcp';
import { REPO_PARAM_DESCRIPTION, TOOL_DESCRIPTIONS, type ToolName } from '../model/tools';

interface McpRepo {
  path: string;
  name: string;
  branch: string | null;
}

export interface McpAnalysisSummary {
  name: string;
  kind: 'flow' | 'document' | 'review';
  title: string;
  summary: string;
  compare?: { baseLabel: string; headLabel: string };
  review?: { baseLabel: string; headLabel: string; flows: string[]; findings: number };
  ref?: { branch: string | null; commit: string };
}

type McpDeliverResult =
  { ok: true; title: string; changed: boolean } | { ok: false; errors: string[] };

/** Vad servern behöver från resten av appen. Kopplas ihop i application. */
export interface McpDeps {
  version: string;
  /** Skillen, som också serveras som resurs till alla MCP-klienter */
  skill: () => string;
  listRepos: () => Promise<McpRepo[]>;
  /** Normaliserar sökvägen och gör repot känt för appen. null om det inte är en mapp. */
  resolveRepo: (path: string) => Promise<string | null>;
  listAnalyses: (repoPath: string) => Promise<McpAnalysisSummary[]>;
  getAnalysis: (
    repoPath: string,
    kind: 'flow' | 'document' | 'review',
    name: string,
  ) => Promise<unknown>;
  deliver: (
    repoPath: string,
    kind: 'flow' | 'review' | 'document',
    name: string,
    content: unknown,
    via: { tool: string; client: string },
  ) => Promise<McpDeliverResult>;
  onActivity?: (activity: McpActivity) => void;
}

export interface McpServerHandle {
  url: string;
  port: number;
  sessions: () => number;
  close: () => Promise<void>;
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

type ToolResult = CallToolResult;

/**
 * Startar HTTP-servern på första lediga porten i listan. Varje MCP-klient får
 * en egen session med en egen McpServer, som SDK:t kräver.
 */
export async function startMcpServer(
  deps: McpDeps,
  options: { ports: readonly number[] },
): Promise<McpServerHandle> {
  const sessions = new Map<string, Session>();
  let port = 0;

  const httpServer = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: t('mcp.internalError') });
      else res.end();
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${MCP_HOST}:${port}`);
    if (url.pathname !== MCP_PATH) {
      sendJson(res, 404, { error: t('mcp.notFound', { path: MCP_PATH }) });
      return;
    }
    const sessionId = req.headers['mcp-session-id'];
    if (typeof sessionId === 'string') {
      const session = sessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: t('mcp.unknownSession') });
        return;
      }
      await session.transport.handleRequest(req, res);
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 400, { error: t('mcp.sessionRequired') });
      return;
    }
    const body = await readJson(req);
    if (!isInitializeRequest(body)) {
      sendJson(res, 400, { error: t('mcp.sessionRequired') });
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableDnsRebindingProtection: true,
      allowedHosts: [`${MCP_HOST}:${port}`, `localhost:${port}`],
    });
    const server = createSession(deps);
    const session = { server, transport };
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    // Transportens onclose-typ saknar undefined, vilket exactOptionalPropertyTypes kräver
    await server.connect(transport as Transport);
    await transport.handleRequest(req, res, body);
    if (transport.sessionId) sessions.set(transport.sessionId, session);
  }

  port = await listenOnFirstFree(httpServer, options.ports);
  return {
    url: mcpUrl(port),
    port,
    sessions: () => sessions.size,
    close: async () => {
      for (const session of sessions.values()) await session.server.close();
      sessions.clear();
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  };
}

async function listenOnFirstFree(server: Server, ports: readonly number[]): Promise<number> {
  let lastError: unknown = new Error(t('mcp.noPort'));
  for (const port of ports) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException): void => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, MCP_HOST);
      });
      const address = server.address();
      return typeof address === 'object' && address ? address.port : port;
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const repoParam = z.string().min(1).describe(REPO_PARAM_DESCRIPTION);

/** En McpServer med Reveriks verktyg och guiden som resurs. */
function createSession(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'reverik', version: deps.version });
  const client = (): string => server.server.getClientVersion()?.name ?? t('mcp.unknownClient');

  const text = (value: unknown, isError = false): ToolResult => ({
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
    ],
    ...(isError ? { isError } : {}),
  });

  /** Kör ett verktyg, loggar utfallet och gör om kastade fel till felresultat. */
  async function run(
    tool: ToolName,
    repo: string | null,
    body: (repoPath: string | null) => Promise<{ result: ToolResult; summary: string }>,
  ): Promise<ToolResult> {
    const record = (ok: boolean, summary: string, repoPath: string | null): void => {
      deps.onActivity?.({
        at: new Date().toISOString(),
        tool,
        client: client(),
        repoPath,
        ok,
        summary,
      });
    };
    let repoPath: string | null = null;
    try {
      if (repo !== null) {
        repoPath = await deps.resolveRepo(repo);
        if (repoPath === null) {
          const message = t('mcp.notARepo', { path: repo });
          record(false, message, null);
          return text(message, true);
        }
      }
      const { result, summary } = await body(repoPath);
      record(result.isError !== true, summary, repoPath);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      record(false, message, repoPath);
      return text(message, true);
    }
  }

  const deliver = (
    tool: ToolName,
    kind: 'flow' | 'review' | 'document',
    repo: string,
    name: string,
    content: unknown,
  ): Promise<ToolResult> =>
    run(tool, repo, async (repoPath) => {
      const result = await deps.deliver(repoPath ?? repo, kind, name, content, {
        tool,
        client: client(),
      });
      if (!result.ok) {
        const errors = result.errors.map((e) => `- ${e}`).join('\n');
        return {
          result: text(t('mcp.rejected', { kind, errors }), true),
          summary: t('mcp.rejectedSummary', { kind, name, count: result.errors.length }),
        };
      }
      const key = result.changed ? 'mcp.saved' : 'mcp.unchanged';
      const summary = t(key, { kind, name, title: result.title });
      return { result: text(summary), summary };
    });

  server.registerResource(
    'guide',
    'reverik://guide',
    {
      title: `${APP_NAME} guide`,
      description: `How to build good flows, documents and reviews for ${APP_NAME}.`,
      mimeType: 'text/markdown',
    },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: deps.skill() }] }),
  );

  server.registerTool(
    'list_repos',
    { description: TOOL_DESCRIPTIONS.list_repos, annotations: { readOnlyHint: true } },
    () =>
      run('list_repos', null, async () => {
        const repos = await deps.listRepos();
        return { result: text(repos), summary: t('mcp.listedRepos', { count: repos.length }) };
      }),
  );

  server.registerTool(
    'list_analyses',
    {
      description: TOOL_DESCRIPTIONS.list_analyses,
      inputSchema: { repo: repoParam },
      annotations: { readOnlyHint: true },
    },
    ({ repo }) =>
      run('list_analyses', repo, async (repoPath) => {
        const list = await deps.listAnalyses(repoPath ?? repo);
        return { result: text(list), summary: t('mcp.listedAnalyses', { count: list.length }) };
      }),
  );

  server.registerTool(
    'get_analysis',
    {
      description: TOOL_DESCRIPTIONS.get_analysis,
      inputSchema: {
        repo: repoParam,
        kind: z.enum(['flow', 'document', 'review']),
        name: analysisNameSchema,
      },
      annotations: { readOnlyHint: true },
    },
    ({ repo, kind, name }) =>
      run('get_analysis', repo, async (repoPath) => {
        const content = await deps.getAnalysis(repoPath ?? repo, kind, name);
        if (content === null) {
          const message = t('mcp.noSuchAnalysis', { kind, name });
          return { result: text(message, true), summary: message };
        }
        return { result: text(content), summary: t('mcp.read', { kind, name }) };
      }),
  );

  server.registerTool(
    'save_flow',
    {
      description: TOOL_DESCRIPTIONS.save_flow,
      inputSchema: {
        repo: repoParam,
        name: analysisNameSchema,
        flow: flowSchema,
        compare: flowCompareSchema.optional(),
      },
      annotations: { idempotentHint: true },
    },
    ({ repo, name, flow, compare }) =>
      deliver('save_flow', 'flow', repo, name, compare ? { flow, compare } : { flow }),
  );

  server.registerTool(
    'save_document',
    {
      description: TOOL_DESCRIPTIONS.save_document,
      inputSchema: { repo: repoParam, name: analysisNameSchema, document: documentSchema },
      annotations: { idempotentHint: true },
    },
    ({ repo, name, document }) => deliver('save_document', 'document', repo, name, document),
  );

  server.registerTool(
    'save_review',
    {
      description: TOOL_DESCRIPTIONS.save_review,
      inputSchema: { repo: repoParam, name: analysisNameSchema, review: reviewSchema },
      annotations: { idempotentHint: true },
    },
    ({ repo, name, review }) => deliver('save_review', 'review', repo, name, review),
  );

  return server;
}
