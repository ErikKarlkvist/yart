import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AgentKind } from '@/common/model/agent';
import { type AgentEntry } from '../model/protocol';
import {
  type Conversation,
  type ConversationSummary,
  type ConversationMode,
  type ReviewBranches,
  conversationSchema,
  conversationSummarySchema,
} from '../model/conversation';

/** Conversation summaries load without reading message histories. All files stay in yart's user data. */
export class ConversationStore {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly pending = new Map<string, Conversation>();

  constructor(private readonly baseDir: string) {}

  async list(repoPath: string): Promise<ConversationSummary[]> {
    try {
      const parsed = conversationSummarySchema
        .array()
        .safeParse(
          JSON.parse(await readFile(join(this.directory(repoPath), 'index.json'), 'utf8')),
        );
      return parsed.success
        ? parsed.data.filter((item) => item.repoPath === repoPath).sort(sortRecent)
        : [];
    } catch {
      return [];
    }
  }

  async get(repoPath: string, id: string): Promise<Conversation | null> {
    if (!/^[\da-f-]{36}$/i.test(id)) return null;
    const pending = this.pending.get(id);
    if (pending) return pending.repoPath === repoPath ? pending : null;
    try {
      const parsed = conversationSchema.safeParse(
        JSON.parse(await readFile(join(this.directory(repoPath), `${id}.json`), 'utf8')),
      );
      return parsed.success && parsed.data.repoPath === repoPath ? parsed.data : null;
    } catch {
      return null;
    }
  }

  create(
    repoPath: string,
    agent: AgentKind,
    mode: ConversationMode = 'general',
    reviewBranches?: ReviewBranches,
  ): Promise<Conversation> {
    return this.locked(repoPath, () => {
      const at = new Date().toISOString();
      const conversation: Conversation = {
        id: randomUUID(),
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
      this.pending.set(conversation.id, conversation);
      return Promise.resolve(conversation);
    });
  }

  append(repoPath: string, id: string, entry: AgentEntry): Promise<Conversation> {
    return this.update(repoPath, id, (current) => ({
      ...current,
      title: current.title || (entry.kind === 'user' ? entry.text.trim().slice(0, 70) : ''),
      updatedAt: entry.at,
      entries: [...current.entries, entry],
    }));
  }

  /** Namnet agenten gav konversationen ersätter den första frågan som titel */
  setTitle(repoPath: string, id: string, title: string): Promise<Conversation> {
    return this.update(repoPath, id, (current) => ({ ...current, title }));
  }

  setThread(repoPath: string, id: string, threadId: string): Promise<Conversation> {
    return this.update(repoPath, id, (current) => ({ ...current, threadId }));
  }

  private update(
    repoPath: string,
    id: string,
    change: (current: Conversation) => Conversation,
  ): Promise<Conversation> {
    return this.locked(repoPath, async () => {
      const current = await this.get(repoPath, id);
      if (!current) throw new Error('Conversation not found');
      const next = change(current);
      if (next.entries.length > 0) {
        await this.save(next);
        this.pending.delete(id);
      } else {
        this.pending.set(id, next);
      }
      return next;
    });
  }

  private async save(conversation: Conversation): Promise<void> {
    const dir = this.directory(conversation.repoPath);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${conversation.id}.json`), JSON.stringify(conversation), 'utf8');
    const summaries = await this.list(conversation.repoPath);
    const summary: ConversationSummary = {
      id: conversation.id,
      repoPath: conversation.repoPath,
      agent: conversation.agent,
      mode: conversation.mode,
      ...(conversation.reviewBranches ? { reviewBranches: conversation.reviewBranches } : {}),
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
    await writeFile(
      join(dir, 'index.json'),
      JSON.stringify(
        [...summaries.filter((item) => item.id !== conversation.id), summary].sort(sortRecent),
      ),
      'utf8',
    );
  }

  private directory(repoPath: string): string {
    const key = createHash('sha256').update(repoPath).digest('hex').slice(0, 24);
    return join(this.baseDir, key);
  }

  private locked<T>(repoPath: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(repoPath) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.queues.set(
      repoPath,
      run.catch(() => undefined),
    );
    return run;
  }
}

function sortRecent(a: ConversationSummary, b: ConversationSummary): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}
