import { existsSync, type FSWatcher, watch } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { t } from '@/common/model/i18n';
import { nameFromFile } from '@/common/model/name';
import { type InboxEvent } from '../ipc/channels';
import { type SavedAnalysis } from '../model/analysis';
import {
  buildGuide,
  DOCUMENTS_DIR,
  errorsFileFor,
  FLOWS_DIR,
  GUIDE_FILE,
  isFlowFile,
  REVIEWS_DIR,
} from '../model/guide';
import { intakeAnalysis, type IntakeKind, type IntakeResult } from './intake';
import { type AnalysisStore } from './store';

const INBOX_DIRS: Readonly<Record<IntakeKind, string>> = {
  flow: FLOWS_DIR,
  review: REVIEWS_DIR,
  document: DOCUMENTS_DIR,
};

/**
 * Läser en fil ur inkorgen, validerar den och sparar den under filnamnet.
 * Fel skrivs bredvid filen som `<namn>.errors.json` så att AI:n kan läsa dem
 * och rätta sig.
 */
export async function importFlowFile(
  store: AnalysisStore,
  repoPath: string,
  name: string,
  kind: IntakeKind = 'flow',
): Promise<IntakeResult> {
  const dir = join(repoPath, INBOX_DIRS[kind]);
  const errorsPath = join(dir, errorsFileFor(name));
  const file = `${INBOX_DIRS[kind]}/${name}`;

  let raw: string;
  try {
    raw = await readFile(join(dir, name), 'utf8');
  } catch {
    return { type: 'rejected', errors: [t('inbox.unreadable', { file })] };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    const errors = [
      t('inbox.invalidJson', { message: e instanceof Error ? e.message : String(e) }),
    ];
    await writeFile(errorsPath, JSON.stringify({ file, errors }, null, 2), 'utf8');
    return { type: 'rejected', errors };
  }

  const result = await intakeAnalysis(
    store,
    repoPath,
    kind,
    nameFromFile(name),
    kind === 'document' ? legacyDocument(json) : json,
    file,
  );
  if (result.type === 'rejected') {
    await writeFile(errorsPath, JSON.stringify({ file, errors: result.errors }, null, 2), 'utf8');
  } else {
    await rm(errorsPath, { force: true });
  }
  return result;
}

/** Äldre dokument länkar flöden med sökvägar i `flowFiles`. Namnen är filnamnen. */
function legacyDocument(json: unknown): unknown {
  if (typeof json !== 'object' || json === null) return json;
  const record = json as Record<string, unknown>;
  if ('flows' in record || !Array.isArray(record.flowFiles)) return json;
  const { flowFiles, ...rest } = record;
  const flows = (flowFiles as unknown[]).map((f) => (typeof f === 'string' ? nameFromFile(f) : f));
  return { ...rest, flows };
}

/** Skriver guiden om den saknas eller är en äldre version. Skapar mappen vid behov. */
export async function writeGuide(repoPath: string): Promise<void> {
  const path = join(repoPath, GUIDE_FILE);
  await mkdir(dirname(path), { recursive: true });
  const content = buildGuide();
  const current = await readFile(path, 'utf8').catch(() => null);
  if (current !== content) await writeFile(path, content, 'utf8');
}

const DEBOUNCE_MS = 250;
/** Hur ofta bevakningen kontrollerar att `.reverik/` finns kvar */
const HEALTH_MS = 3000;
const REARM_MS = 1000;

/**
 * Bevakar `.reverik/` i det valda repot. Importerar det som redan ligger där
 * vid start och sedan varje fil som sparas. Försvinner mappen, till exempel
 * för att en agent städar, skapas den om och bevakningen armas på nytt.
 */
export class FlowInbox {
  private watcher: FSWatcher | null = null;
  private health: NodeJS.Timeout | null = null;
  private rearmTimer: NodeJS.Timeout | null = null;
  private repoPath: string | null = null;
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly store: AnalysisStore,
    private readonly listAll: (repoPath: string) => Promise<SavedAnalysis[]>,
    private readonly emit: (event: InboxEvent) => void,
  ) {}

  async watch(repoPath: string): Promise<void> {
    this.stop();
    this.repoPath = repoPath;
    await this.arm(repoPath);
    this.health = setInterval(() => {
      if (this.repoPath === repoPath && !existsSync(inboxRoot(repoPath))) this.rearm(repoPath);
    }, HEALTH_MS);
  }

  stop(): void {
    this.closeWatcher();
    if (this.health) clearInterval(this.health);
    this.health = null;
    if (this.rearmTimer) clearTimeout(this.rearmTimer);
    this.rearmTimer = null;
    this.repoPath = null;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  /** Skapar mapparna, startar bevakningen och skannar det som redan ligger där. */
  private async arm(repoPath: string): Promise<void> {
    if (this.repoPath !== repoPath) return;
    await writeGuide(repoPath);
    for (const kind of Object.keys(INBOX_DIRS) as IntakeKind[]) {
      await mkdir(join(repoPath, INBOX_DIRS[kind]), { recursive: true });
    }
    this.closeWatcher();
    try {
      // Rekursivt så en mapp som tas bort och kommer tillbaka fångas utan ny bevakare
      this.watcher = watch(inboxRoot(repoPath), { recursive: true }, (_event, filename) => {
        if (typeof filename === 'string') this.onChange(repoPath, filename);
      });
    } catch (error) {
      console.error(error);
      this.rearm(repoPath);
      return;
    }
    this.watcher.on('error', () => {
      this.rearm(repoPath);
    });

    for (const kind of Object.keys(INBOX_DIRS) as IntakeKind[]) {
      const dir = join(repoPath, INBOX_DIRS[kind]);
      const names = await readdir(dir).catch(() => [] as string[]);
      for (const name of names.filter(isFlowFile).sort()) {
        await this.importAndEmit(repoPath, kind, name, true);
      }
    }
  }

  private rearm(repoPath: string): void {
    if (this.repoPath !== repoPath || this.rearmTimer) return;
    this.closeWatcher();
    this.rearmTimer = setTimeout(() => {
      this.rearmTimer = null;
      void this.arm(repoPath);
    }, REARM_MS);
  }

  private closeWatcher(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  /** Sökvägen är relativ `.reverik/`, t.ex. `flows/add-todo.json`. */
  private onChange(repoPath: string, relative: string): void {
    const [dir, name, ...rest] = relative.split(/[\\/]/);
    if (!dir || !name || rest.length > 0 || !isFlowFile(name)) return;
    const kind = (Object.keys(INBOX_DIRS) as IntakeKind[]).find(
      (k) => basename(INBOX_DIRS[k]) === dir,
    );
    if (kind) this.schedule(repoPath, kind, name);
  }

  private schedule(repoPath: string, kind: IntakeKind, name: string): void {
    const key = `${kind}/${name}`;
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing);
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        if (this.repoPath === repoPath) void this.importAndEmit(repoPath, kind, name);
      }, DEBOUNCE_MS),
    );
  }

  private async importAndEmit(
    repoPath: string,
    kind: IntakeKind,
    name: string,
    initial = false,
  ): Promise<void> {
    const file = `${INBOX_DIRS[kind]}/${name}`;
    const via = { kind: 'file', file } as const;
    // En fil som tagits bort är inget att rapportera
    if (!existsSync(join(repoPath, file))) return;
    try {
      const result = await importFlowFile(this.store, repoPath, name, kind);
      if (result.type === 'imported') {
        this.emit({
          type: 'imported',
          repoPath,
          via,
          analysis: result.analysis,
          list: await this.listAll(repoPath),
          initial,
        });
      } else if (result.type === 'rejected') {
        this.emit({ type: 'rejected', repoPath, via, errors: result.errors });
      }
    } catch (error) {
      console.error(error);
      this.emit({
        type: 'rejected',
        repoPath,
        via,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
}

function inboxRoot(repoPath: string): string {
  return dirname(join(repoPath, FLOWS_DIR));
}
