import { pool } from '../db/pool';
import type { NewTodo, Todo } from '../types';

interface TodoRow {
  id: number;
  title: string;
  completed: boolean;
  created_at: Date;
}

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  };
}

export class TodoRepository {
  async findAll(): Promise<Todo[]> {
    const result = await pool.query<TodoRow>(
      'SELECT id, title, completed, created_at FROM todos ORDER BY created_at DESC',
    );
    return result.rows.map(toTodo);
  }

  async insert(todo: NewTodo): Promise<Todo> {
    const result = await pool.query<TodoRow>(
      'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, completed, created_at',
      [todo.title],
    );
    return toTodo(result.rows[0]!);
  }

  async setCompleted(id: number, completed: boolean): Promise<Todo | null> {
    const result = await pool.query<TodoRow>(
      'UPDATE todos SET completed = $2 WHERE id = $1 RETURNING id, title, completed, created_at',
      [id, completed],
    );
    const row = result.rows[0];
    return row ? toTodo(row) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
