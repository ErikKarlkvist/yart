import type { Todo } from '../types';

interface Props {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onRemove: (id: number) => void;
}

export function TodoItem({ todo, onToggle, onRemove }: Props) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={todo.completed} onChange={() => onToggle(todo)} />
        <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
          {todo.title}
        </span>
      </label>
      <button type="button" onClick={() => onRemove(todo.id)} aria-label="Ta bort">
        ×
      </button>
    </li>
  );
}
