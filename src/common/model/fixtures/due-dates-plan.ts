import { type YartDocument } from '../document';

/**
 * Ett planeringsdokument för demo-appen: förfallodatum på todos. Texten är
 * kort för människor, `plan` är den detaljerade planen för en AI-agent.
 */
export const dueDatesPlan: YartDocument = {
  title: 'Due dates on todos',
  summary:
    'Todos get an optional due date that is set in the form, stored in Postgres and shown in the list.',
  content: [
    '## Goal',
    '- A todo can have an optional **due date**',
    '- Overdue todos stand out in the list',
    '',
    '## What changes',
    '- The add form gets a date field',
    '- `POST /api/todos` accepts `dueDate`',
    '- The `todos` table gets a `due_date` column',
    '',
    '## Open questions',
    '- Should the list be sorted by due date?',
  ].join('\n'),
  plan: [
    '1. Database: add `due_date DATE NULL` to `todos` in backend/src/db/schema.sql, with a migration for existing databases.',
    '2. Types: add `dueDate: string | null` to `Todo` and an optional `dueDate` to `NewTodo` in backend/src/types.ts.',
    '3. Route: extend `newTodoSchema` in backend/src/routes/todos.ts with `dueDate: z.iso.date().optional()`; a bad date answers 400.',
    '4. Repository: write and read `due_date` in TodoRepository.insert and findAll, mapped to `dueDate`.',
    '5. Cache: nothing to change, TodoService.create already invalidates the list.',
    '6. Frontend: add a date input to AddTodoForm, pass it through useTodos.addTodo and createTodo, and mark overdue todos in the list.',
    '7. Verify: add a todo with and without a date, reload, and check that both render and that an invalid date is rejected.',
  ].join('\n'),
  flows: ['add-todo'],
};
