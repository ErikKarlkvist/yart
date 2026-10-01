import { redis } from './redis';
import type { Todo } from '../types';

const KEY = 'todos:all';
const TTL_SECONDS = 60;

/** Cachar hela listan. Alla skrivningar invaliderar den. */
export class TodoCache {
  async getAll(): Promise<Todo[] | null> {
    const cached = await redis.get(KEY);
    return cached ? (JSON.parse(cached) as Todo[]) : null;
  }

  async setAll(todos: Todo[]): Promise<void> {
    await redis.set(KEY, JSON.stringify(todos), 'EX', TTL_SECONDS);
  }

  async invalidate(): Promise<void> {
    await redis.del(KEY);
  }
}
