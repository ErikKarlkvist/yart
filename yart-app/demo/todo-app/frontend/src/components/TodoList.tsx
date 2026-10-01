import type { Todo } from '../types';
import { TodoItem } from './TodoItem';

interface Props {
  todos: Todo[];
  onToggle: (todo: Todo) => void;
  onRemove: (id: number) => void;
}

export function TodoList({ todos, onToggle, onRemove }: Props) {
  if (todos.length === 0) return <p>Inget att göra.</p>;
  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onRemove={onRemove} />
      ))}
    </ul>
  );
}
