import { TodoCache } from '../cache/TodoCache';
import { notifyTodoCreated } from '../notifications/webhook';
import { TodoRepository } from '../repositories/TodoRepository';
import type { NewTodo, Todo } from '../types';

export class TodoService {
  constructor(
    private readonly repository = new TodoRepository(),
    private readonly cache = new TodoCache(),
  ) {}

  async list(): Promise<Todo[]> {
    const cached = await this.cache.getAll();
    if (cached) return cached;

    const todos = await this.repository.findAll();
    await this.cache.setAll(todos);
    return todos;
  }

  async create(input: NewTodo): Promise<Todo> {
    const todo = await this.repository.insert(input);
    await this.cache.invalidate();
    void notifyTodoCreated(todo);
    return todo;
  }

  async setCompleted(id: number, completed: boolean): Promise<Todo | null> {
    const todo = await this.repository.setCompleted(id, completed);
    if (todo) await this.cache.invalidate();
    return todo;
  }

  async remove(id: number): Promise<boolean> {
    const removed = await this.repository.delete(id);
    if (removed) await this.cache.invalidate();
    return removed;
  }
}
