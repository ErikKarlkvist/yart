import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ReverikDocument } from '@/common/model/document';
import { type Flow } from '@/common/model/flow';
import { type FlowCompare, type Review } from '@/common/model/review';
import {
  type AnalysisRef,
  type SavedAnalysis,
  savedAnalysesSchema,
  sortAnalyses,
} from '../model/analysis';

/** Det som sparas: namnet, var det kom ifrån och innehållet per sort. */
export type NewAnalysis = {
  name: string;
  ref?: AnalysisRef | null;
  /** Konversationen i appen som levererade, om någon */
  conversationId?: string | undefined;
} & (
  | { kind: 'flow'; flow: Flow; compare?: FlowCompare }
  | { kind: 'document'; document: ReverikDocument }
  | { kind: 'review'; review: Review }
);

/**
 * Sparar analyser som en JSON-fil per repo under en basmapp. Basmappen
 * skickas in så att lagringen går att testa utan Electron. Skrivningar till
 * samma repo köas, så två agenter som levererar samtidigt inte skriver över
 * varandra.
 */
export class AnalysisStore {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly baseDir: string) {}

  async list(repoPath: string): Promise<SavedAnalysis[]> {
    return sortAnalyses(await this.read(repoPath));
  }

  async get(
    repoPath: string,
    kind: SavedAnalysis['kind'],
    name: string,
  ): Promise<SavedAnalysis | null> {
    return (await this.read(repoPath)).find((a) => a.kind === kind && a.name === name) ?? null;
  }

  /**
   * Sparar en analys. Finns redan en med samma sort och namn ersätts den och
   * behåller sitt id, så att en rättad leverans inte ger dubbletter.
   */
  async upsert(repoPath: string, input: NewAnalysis): Promise<SavedAnalysis> {
    return this.locked(repoPath, async () => {
      const list = await this.read(repoPath);
      const existing = list.find((a) => a.kind === input.kind && a.name === input.name);
      const base = {
        id: existing?.id ?? randomUUID(),
        repoPath,
        origin: 'ai' as const,
        createdAt: new Date().toISOString(),
        name: input.name,
        ...(input.ref ? { ref: input.ref } : {}),
        // En uppdatering utifrån behåller konversationen som skapade analysen
        ...((input.conversationId ?? existing?.conversationId)
          ? { conversationId: input.conversationId ?? existing?.conversationId }
          : {}),
      };
      const analysis: SavedAnalysis =
        input.kind === 'document'
          ? { ...base, kind: 'document', document: input.document }
          : input.kind === 'review'
            ? { ...base, kind: 'review', review: input.review }
            : {
                ...base,
                kind: 'flow',
                flow: input.flow,
                ...(input.compare ? { compare: input.compare } : {}),
              };
      await this.write(repoPath, [...list.filter((a) => a.id !== analysis.id), analysis]);
      return analysis;
    });
  }

  async delete(repoPath: string, id: string): Promise<SavedAnalysis[]> {
    return this.locked(repoPath, async () => {
      const remaining = (await this.read(repoPath)).filter((a) => a.id !== id);
      await this.write(repoPath, remaining);
      return sortAnalyses(remaining);
    });
  }

  /** Kör `task` efter tidigare köade uppgifter för samma repo. */
  private locked<T>(repoPath: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(repoPath) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.queues.set(
      repoPath,
      run.catch(() => undefined),
    );
    return run;
  }

  private filePath(repoPath: string): string {
    const key = createHash('sha1').update(repoPath).digest('hex').slice(0, 16);
    return join(this.baseDir, `${key}.json`);
  }

  private async read(repoPath: string): Promise<SavedAnalysis[]> {
    try {
      const raw = await readFile(this.filePath(repoPath), 'utf8');
      const parsed = savedAnalysesSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  private async write(repoPath: string, list: SavedAnalysis[]): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(this.filePath(repoPath), JSON.stringify(list, null, 2), 'utf8');
  }
}
