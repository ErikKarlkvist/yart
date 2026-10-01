import { type Flow } from '../flow';

/**
 * Demon för alternativ: kryssrutan i listan skickar en PATCH som kan gå tre
 * vägar, med ett alternativ inuti ett annat. Källhänvisningarna pekar på
 * demo/todo-app och kontrolleras i common/main/demo-fixtures.test.ts.
 */
export const toggleTodoFlow: Flow = {
  question: 'What happens when a todo is ticked off, and what if it fails?',
  title: 'Toggle todo',
  summary:
    'The checkbox sends a PATCH through the hook and the API client. The backend validates the request, updates the row in Postgres and clears the cached list; a bad request or a missing row ends in an error that leaves the list as it was.',
  trigger: { kind: 'user', label: 'User ticks the checkbox', nodeId: 'todo-item' },
  systems: [
    {
      id: 'frontend',
      kind: 'app',
      label: 'Todo frontend',
      description: 'The React app in the browser',
    },
    { id: 'backend', kind: 'api', label: 'Todo API', description: 'The Express server' },
    { id: 'postgres', kind: 'db', label: 'Postgres' },
    { id: 'redis', kind: 'cache', label: 'Redis' },
  ],
  nodes: [
    {
      id: 'todo-item',
      kind: 'ui',
      system: 'frontend',
      label: 'TodoItem',
      description: 'One row in the list with a checkbox and a remove button',
      source: { file: 'frontend/src/components/TodoItem.tsx', line: 9 },
    },
    {
      id: 'use-todos',
      kind: 'handler',
      system: 'frontend',
      role: 'Hook',
      label: 'useTodos.toggleTodo',
      description: 'Keeps the list in state and swaps in the updated todo',
      source: { file: 'frontend/src/hooks/useTodos.ts', line: 20 },
    },
    {
      id: 'todos-api',
      kind: 'handler',
      system: 'frontend',
      label: 'todosApi.updateTodo',
      description: 'Thin client over fetch that throws on any status other than 2xx',
      source: { file: 'frontend/src/api/todosApi.ts', line: 21 },
    },
    {
      id: 'patch-route',
      kind: 'http',
      system: 'backend',
      label: 'PATCH /api/todos/:id',
      source: { file: 'backend/src/routes/todos.ts', line: 26 },
    },
    {
      id: 'todo-service',
      kind: 'service',
      system: 'backend',
      label: 'TodoService.setCompleted',
      source: { file: 'backend/src/services/TodoService.ts', line: 28 },
    },
    {
      id: 'todo-repository',
      kind: 'service',
      system: 'backend',
      label: 'TodoRepository.setCompleted',
      source: { file: 'backend/src/repositories/TodoRepository.ts', line: 36 },
    },
    {
      id: 'postgres',
      kind: 'db',
      system: 'postgres',
      label: 'Postgres todos',
      tables: [
        {
          name: 'todos',
          description: 'One row per todo',
          columns: [
            { name: 'id', type: 'serial', primaryKey: true },
            { name: 'title', type: 'text' },
            { name: 'completed', type: 'boolean', description: 'Defaults to false' },
            { name: 'created_at', type: 'timestamptz' },
          ],
          source: { file: 'backend/src/db/schema.sql', line: 7 },
        },
      ],
    },
    {
      id: 'todo-cache',
      kind: 'cache',
      system: 'redis',
      label: 'Redis todos:all',
      tables: [
        {
          name: 'todos:all',
          description: 'The whole list as JSON, TTL 60 seconds',
          source: { file: 'backend/src/cache/TodoCache.ts', line: 4 },
        },
      ],
    },
  ],
  edges: [
    {
      id: 'toggle',
      from: 'todo-item',
      to: 'use-todos',
      label: 'onToggle(todo)',
      payload: 'The todo as it is shown, with its current completed flag',
      source: { file: 'frontend/src/components/TodoItem.tsx', line: 13 },
    },
    {
      id: 'update',
      from: 'use-todos',
      to: 'todos-api',
      label: 'updateTodo(id, !completed)',
      source: { file: 'frontend/src/hooks/useTodos.ts', line: 21 },
    },
    {
      id: 'patch',
      from: 'todos-api',
      to: 'patch-route',
      label: 'PATCH /api/todos/7',
      payload: '{ "completed": true }',
      source: { file: 'frontend/src/api/todosApi.ts', line: 22 },
    },
    {
      id: 'bad-request',
      from: 'patch-route',
      to: 'todos-api',
      label: '400 Bad Request',
      payload: '{ "error": "ogiltig begäran" }',
      source: { file: 'backend/src/routes/todos.ts', line: 30 },
    },
    {
      id: 'set-completed',
      from: 'patch-route',
      to: 'todo-service',
      label: 'service.setCompleted(id, completed)',
      source: { file: 'backend/src/routes/todos.ts', line: 33 },
    },
    {
      id: 'repository-update',
      from: 'todo-service',
      to: 'todo-repository',
      label: 'repository.setCompleted(id, completed)',
      source: { file: 'backend/src/services/TodoService.ts', line: 29 },
    },
    {
      id: 'update-row',
      tables: ['todos'],
      from: 'todo-repository',
      to: 'postgres',
      label: 'UPDATE todos SET completed',
      payload: 'WHERE id = $1 RETURNING …',
      response: 'The updated row, or no rows when the id does not exist',
      source: { file: 'backend/src/repositories/TodoRepository.ts', line: 37 },
    },
    {
      id: 'invalidate',
      tables: ['todos:all'],
      from: 'todo-service',
      to: 'todo-cache',
      label: 'DEL todos:all',
      source: { file: 'backend/src/services/TodoService.ts', line: 30 },
    },
    {
      id: 'not-found',
      from: 'patch-route',
      to: 'todos-api',
      label: '404 Not Found',
      payload: '{ "error": "finns inte" }',
      source: { file: 'backend/src/routes/todos.ts', line: 35 },
    },
    {
      id: 'ok',
      from: 'patch-route',
      to: 'todos-api',
      label: '200 OK',
      payload: '{ "id": 7, "title": "Buy milk", "completed": true, "createdAt": "…" }',
      source: { file: 'backend/src/routes/todos.ts', line: 38 },
    },
    {
      id: 'resolve',
      from: 'todos-api',
      to: 'use-todos',
      label: 'updated todo',
      source: { file: 'frontend/src/api/todosApi.ts', line: 28 },
    },
    {
      id: 'reject',
      from: 'todos-api',
      to: 'use-todos',
      label: 'throw Error',
      payload: "Error('Kunde inte uppdatera todo')",
      source: { file: 'frontend/src/api/todosApi.ts', line: 27 },
    },
    {
      id: 'replace',
      from: 'use-todos',
      to: 'todo-item',
      label: 'setTodos(map …)',
      payload: 'The list with the updated todo swapped in',
      source: { file: 'frontend/src/hooks/useTodos.ts', line: 22 },
    },
  ],
  steps: [
    {
      edgeId: 'toggle',
      description:
        'The user ticks the checkbox on a todo. The row hands the whole todo to the hook, which decides the new value from what is shown.',
    },
    {
      edgeId: 'update',
      description:
        'The hook asks the API client to flip the completed flag. Nothing changes on screen yet; the list waits for the server.',
    },
    {
      edgeId: 'patch',
      description: 'The client sends a PATCH for this todo with the new completed value as JSON.',
    },
    {
      alt: 'Valid id and body?',
      branches: [
        {
          label: 'Valid',
          steps: [
            {
              edgeId: 'set-completed',
              description:
                'The route accepts the request and asks the service to store the new value.',
            },
            {
              edgeId: 'repository-update',
              description: 'The service hands the update to the repository.',
            },
            {
              edgeId: 'update-row',
              description:
                'Postgres updates the row and returns it. If no todo has that id, nothing is updated and no row comes back.',
            },
            {
              alt: 'Row found?',
              branches: [
                {
                  label: 'Found',
                  steps: [
                    {
                      edgeId: 'invalidate',
                      description:
                        'The cached list in Redis is now out of date, so the service removes it. The next page load reads fresh data.',
                    },
                    {
                      edgeId: 'ok',
                      description: 'The route answers 200 with the updated todo.',
                    },
                    {
                      edgeId: 'resolve',
                      description: 'The client parses the JSON and returns the todo to the hook.',
                    },
                    {
                      edgeId: 'replace',
                      description:
                        'The hook swaps the updated todo into the list, and the row shows it as done.',
                    },
                  ],
                },
                {
                  label: 'Not found',
                  steps: [
                    {
                      edgeId: 'not-found',
                      description:
                        'The todo was deleted elsewhere, so the route answers 404. The cache is left alone because nothing changed.',
                    },
                    {
                      edgeId: 'reject',
                      description:
                        'The client throws on the error status. The hook does not catch it, so the checkbox stays as it was and the user sees no message.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Invalid',
          steps: [
            {
              edgeId: 'bad-request',
              description:
                'The id is not a number or the body has no boolean, so the route answers 400 before touching any data. The app itself never sends this, but another client could.',
            },
            {
              edgeId: 'reject',
              description:
                'The client throws on the error status, and the list on screen stays as it was.',
            },
          ],
        },
      ],
    },
  ],
};
