import { mkdir, open, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const SESSION_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

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
    const normalize = (path: string): string => {
      const resolved = resolve(path).replace(/\\/g, '/');
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(cwd) === normalize(repoPath);
  } catch {
    return false;
  } finally {
    await file?.close();
  }
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
