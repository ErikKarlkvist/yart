import { existsSync, type FSWatcher, watch } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { headRef, resolveCommit } from '@/common/main/git';
import { type ReverikDocument, validateDocument } from '@/common/model/document';
import { type Flow, validateFlow } from '@/common/model/flow';
import { type Review, validateReviewDocument } from '@/common/model/review';
import { t } from '@/common/model/i18n';
import { type InboxEvent } from '../ipc/channels';
import { type AnalysisRef, type SavedAnalysis } from '../model/analysis';
import {
  buildGuide,
  DOCUMENTS_DIR,
  errorsFileFor,
  FLOWS_DIR,
  GUIDE_FILE,
  isFlowFile,
  REVIEWS_DIR,
} from '../model/guide';
import { type AnalysisStore } from './store';
import { verifySources } from './verify';

export type ImportResult =
  | { type: 'imported'; analysis: SavedAnalysis }
  | { type: 'rejected'; errors: string[] }
  /** Filen är redan importerad med samma innehåll, eller borttagen */
  | { type: 'unchanged' };

export type InboxKind = 'flow' | 'review' | 'document';

const INBOX_DIRS: Readonly<Record<InboxKind, string>> = {
  flow: FLOWS_DIR,
  review: REVIEWS_DIR,
  document: DOCUMENTS_DIR,
};

type Parsed =
  | { ok: true; kind: 'flow'; flow: Flow; review?: Review; ref: AnalysisRef | null }
  | { ok: true; kind: 'document'; document: ReverikDocument; ref: AnalysisRef | null }
  | { ok: false; errors: string[] };

/**
 * Läser en flödes- eller reviewfil, validerar den och sparar den. Fel skrivs
 * bredvid filen som `<namn>.errors.json` så att AI:n kan läsa dem och rätta sig.
 */
export async function importFlowFile(
  store: AnalysisStore,
  repoPath: string,
  name: string,
  kind: InboxKind = 'flow',
): Promise<ImportResult> {
  const dir = join(repoPath, INBOX_DIRS[kind]);
  const errorsPath = join(dir, errorsFileFor(name));
  const file = `${INBOX_DIRS[kind]}/${name}`;

  let raw: string;
  try {
    raw = await readFile(join(dir, name), 'utf8');
  } catch {
    return { type: 'unchanged' };
  }

  const parsed = await parseAndVerify(repoPath, raw, kind);
  if (!parsed.ok) {
    await writeFile(errorsPath, JSON.stringify({ file, errors: parsed.errors }, null, 2), 'utf8');
    return { type: 'rejected', errors: parsed.errors };
  }
  await rm(errorsPath, { force: true });

  const existing = (await store.list(repoPath)).find((a) => a.file === file);
  if (existing?.kind === parsed.kind && existing.ref?.commit === parsed.ref?.commit) {
    const unchanged =
      parsed.kind === 'document'
        ? existing.kind === 'document' &&
          JSON.stringify(existing.document) === JSON.stringify(parsed.document)
        : existing.kind === 'flow' &&
          JSON.stringify(existing.flow) === JSON.stringify(parsed.flow) &&
          JSON.stringify(existing.review) === JSON.stringify(parsed.review);
    if (unchanged) return { type: 'unchanged' };
  }
  if (parsed.kind === 'document') {
    return {
      type: 'imported',
      analysis: await store.upsertDocumentFromFile(repoPath, file, parsed.document, parsed.ref),
    };
  }
  return {
    type: 'imported',
    analysis: await store.upsertFromFile(repoPath, file, parsed.flow, parsed.review, parsed.ref),
  };
}

/**
 * Ett flöde beskriver arbetsträdet och kontrolleras mot det. En reviews head
 * kontrolleras mot branchen den säger sig beskriva om den finns i repot och
 * inte är utcheckad, annars mot arbetsträdet. Base beskriver en annan branch
 * och kontrolleras inte.
 */
async function parseAndVerify(repoPath: string, raw: string, kind: InboxKind): Promise<Parsed> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      errors: [t('inbox.invalidJson', { message: e instanceof Error ? e.message : String(e) })],
    };
  }
  if (kind === 'document') {
    const validated = validateDocument(json);
    if (!validated.ok) return validated;
    return { ok: true, kind, document: validated.document, ref: await headRef(repoPath) };
  }
  if (kind === 'review') {
    const validated = validateReviewDocument(json);
    if (!validated.ok) return validated;
    return checkSources(repoPath, validated.flow, validated.review);
  }
  const validated = validateFlow(json);
  if (!validated.ok) return validated;
  return checkSources(repoPath, validated.flow);
}

async function checkSources(repoPath: string, flow: Flow, review?: Review): Promise<Parsed> {
  const head = await headRef(repoPath);
  let ref: AnalysisRef | null = head;
  let resolvedReview = review;
  if (review) {
    const headCommit = await resolveCommit(repoPath, review.headLabel);
    if (headCommit) ref = { branch: review.headLabel, commit: headCommit };
    const baseCommit = await resolveCommit(repoPath, review.baseLabel);
    if (baseCommit) resolvedReview = { ...review, baseCommit };
  }
  // Är commiten utcheckad räcker arbetsträdet, som även har ocommittade ändringar.
  const verifyAt = ref && ref.commit !== head?.commit ? ref.commit : null;
  const errors = await verifySources(repoPath, flow, verifyAt);
  if (errors.length > 0) return { ok: false, errors };
  return resolvedReview
    ? { ok: true, kind: 'flow', flow, review: resolvedReview, ref }
    : { ok: true, kind: 'flow', flow, ref };
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
    for (const kind of Object.keys(INBOX_DIRS) as InboxKind[]) {
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

    for (const kind of Object.keys(INBOX_DIRS) as InboxKind[]) {
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
    const kind = (Object.keys(INBOX_DIRS) as InboxKind[]).find(
      (k) => basename(INBOX_DIRS[k]) === dir,
    );
    if (kind) this.schedule(repoPath, kind, name);
  }

  private schedule(repoPath: string, kind: InboxKind, name: string): void {
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
    kind: InboxKind,
    name: string,
    initial = false,
  ): Promise<void> {
    const file = `${INBOX_DIRS[kind]}/${name}`;
    try {
      const result = await importFlowFile(this.store, repoPath, name, kind);
      if (result.type === 'imported') {
        this.emit({
          type: 'imported',
          repoPath,
          file,
          analysis: result.analysis,
          list: await this.listAll(repoPath),
          initial,
        });
      } else if (result.type === 'rejected') {
        this.emit({ type: 'rejected', repoPath, file, errors: result.errors });
      }
    } catch (error) {
      console.error(error);
      this.emit({
        type: 'rejected',
        repoPath,
        file,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
}

function inboxRoot(repoPath: string): string {
  return dirname(join(repoPath, FLOWS_DIR));
}
