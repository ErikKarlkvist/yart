import { mkdir, open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const SESSION_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
const SESSION_PREVIEW_BYTES = 96 * 1024;

export interface CodexSessionSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export function codexSessionIdFromPath(filePath: string): string | null {
  return SESSION_ID.exec(filePath)?.[1] ?? null;
}

function codexSessionDirectory(): string {
  return join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
}

async function listSessionFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSessionFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
  }
  return files;
}

async function sessionUsesRepo(filePath: string, repoPath: string): Promise<boolean> {
  let file;
  try {
    file = await open(filePath, 'r');
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const firstLine = buffer.toString('utf8', 0, bytesRead).split(/\r?\n/, 1)[0];
    if (!firstLine) return false;
    const entry: unknown = JSON.parse(firstLine);
    if (typeof entry !== 'object' || entry === null) return false;
    const payload = (entry as { payload?: unknown }).payload;
    if (typeof payload !== 'object' || payload === null) return false;
    const cwd = (payload as { cwd?: unknown }).cwd;
    if (typeof cwd !== 'string') return false;
    return normalizeRepoPath(cwd) === normalizeRepoPath(repoPath);
  } catch {
    return false;
  } finally {
    await file?.close();
  }
}

function normalizeRepoPath(path: string): string {
  const resolved = resolve(path).replace(/\\/g, '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function stringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'string' ? property : null;
}

function sessionTitle(content: Buffer): string | null {
  for (const line of content.toString('utf8').split(/\r?\n/)) {
    if (!line) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;
    const payload = (entry as { payload?: unknown }).payload;
    const kind = stringProperty(payload, 'type');
    if (kind === 'user_message') {
      const message = stringProperty(payload, 'message');
      if (message?.trim()) return message.trim();
    }
    if (kind === 'message' && stringProperty(payload, 'role') === 'user') {
      const contentItems = (payload as { content?: unknown }).content;
      if (!Array.isArray(contentItems)) continue;
      const text = contentItems
        .map((item: unknown) => stringProperty(item, 'text'))
        .filter((item): item is string => item !== null)
        .join(' ')
        .trim();
      if (text) return text;
    }
  }
  return null;
}

function normalizeSessionTitle(title: string | null, filePath: string): string {
  const compact = title?.replace(/\s+/g, ' ').trim();
  if (compact) return compact.length > 96 ? `${compact.slice(0, 93)}…` : compact;
  const id = codexSessionIdFromPath(filePath);
  return id ? `Codex chat · ${id.slice(0, 8)}` : 'Codex chat';
}

/** Finds saved chats whose Codex working directory is exactly this folder. */
export async function listCodexSessions(
  repoPath: string,
  directory = codexSessionDirectory(),
): Promise<CodexSessionSummary[]> {
  const files = await listSessionFiles(directory);
  const sessions = await Promise.all(
    files.map(async (filePath): Promise<CodexSessionSummary | null> => {
      const id = codexSessionIdFromPath(filePath);
      if (!id || !(await sessionUsesRepo(filePath, repoPath))) return null;
      try {
        const [metadata, file] = await Promise.all([stat(filePath), open(filePath, 'r')]);
        try {
          const buffer = Buffer.alloc(Math.min(metadata.size, SESSION_PREVIEW_BYTES));
          const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
          const title = sessionTitle(buffer.subarray(0, bytesRead));
          return { id, title: normalizeSessionTitle(title, filePath), updatedAt: metadata.mtimeMs };
        } finally {
          await file.close();
        }
      } catch {
        return null;
      }
    }),
  );
  return sessions
    .filter((session): session is CodexSessionSummary => session !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function findNewCodexSession(
  directory: string,
  knownFiles: ReadonlySet<string>,
  repoPath: string,
): Promise<string | null> {
  const files = await listSessionFiles(directory);
  for (const filePath of files) {
    if (knownFiles.has(filePath)) continue;
    const sessionId = codexSessionIdFromPath(filePath);
    if (sessionId && (await sessionUsesRepo(filePath, repoPath))) return sessionId;
  }
  return null;
}

/**
 * Waits for the session file created by a newly launched Codex process. Starts
 * are serialized by TerminalSessions so simultaneous tabs cannot claim the
 * same newly-created session.
 */
export async function waitForNewCodexSession(
  knownFiles: ReadonlySet<string>,
  repoPath: string,
  timeoutMs = 30_000,
  signal?: AbortSignal,
): Promise<string | null> {
  const directory = codexSessionDirectory();
  await mkdir(directory, { recursive: true });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !signal?.aborted) {
    const sessionId = await findNewCodexSession(directory, knownFiles, repoPath);
    if (sessionId) return sessionId;
    await new Promise<void>((resolveDelay) => {
      const timer = setTimeout(done, 300);
      function done(): void {
        clearTimeout(timer);
        signal?.removeEventListener('abort', done);
        resolveDelay();
      }
      signal?.addEventListener('abort', done, { once: true });
    });
  }
  return null;
}

export async function snapshotCodexSessionFiles(): Promise<ReadonlySet<string>> {
  const directory = codexSessionDirectory();
  await mkdir(directory, { recursive: true });
  return new Set(await listSessionFiles(directory));
}
