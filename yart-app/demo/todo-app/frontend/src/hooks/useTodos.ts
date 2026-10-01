import { useCallback, useEffect, useState } from 'react';
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../api/todosApi';
import type { Todo } from '../types';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodos()
      .then(setTodos)
      .finally(() => setLoading(false));
  }, []);

  const addTodo = useCallback(async (title: string) => {
    const created = await createTodo(title);
    setTodos((current) => [created, ...current]);
  }, []);

  const toggleTodo = useCallback(async (todo: Todo) => {
    const updated = await updateTodo(todo.id, !todo.completed);
    setTodos((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const removeTodo = useCallback(async (id: number) => {
    await deleteTodo(id);
    setTodos((current) => current.filter((t) => t.id !== id));
  }, []);

  return { todos, loading, addTodo, toggleTodo, removeTodo };
}
