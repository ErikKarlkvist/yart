import { AddTodoForm } from './components/AddTodoForm';
import { TodoList } from './components/TodoList';
import { useTodos } from './hooks/useTodos';

export function App() {
  const { todos, loading, addTodo, toggleTodo, removeTodo } = useTodos();

  return (
    <main>
      <h1>Todo</h1>
      <AddTodoForm onAdd={addTodo} />
      {loading ? (
        <p>Laddar…</p>
      ) : (
        <TodoList todos={todos} onToggle={toggleTodo} onRemove={removeTodo} />
      )}
    </main>
  );
}
