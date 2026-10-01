import { type Flow } from '../flow';
import { type FlowCompare, type Review } from '../review';
import { addTodoFlow } from './add-todo';

/**
 * En review av en tänkt ändring i demo-appen: todos kan läggas i listor.
 * Formuläret får en listväljare, anropet bär listId och backend kontrollerar
 * att listan finns. Ändringen är hypotetisk, så källhänvisningarna pekar på
 * närmaste befintliga kod i demo/todo-app och kontrolleras precis som de
 * andra fixturerna.
 */

const base = addTodoFlow;
const node = (id: string): Flow['nodes'][number] => {
  const found = base.nodes.find((n) => n.id === id);
  if (!found) throw new Error(id);
  return found;
};
const edge = (id: string): Flow['edges'][number] => {
  const found = base.edges.find((e) => e.id === id);
  if (!found) throw new Error(id);
  return found;
};

export const addTodoWithListFlow: Flow = {
  question: 'What happens when a todo is added to a list?',
  title: 'Add todo to a list',
  summary:
    'The form sends the title and a list id. The service checks that the list exists, stores the row in Postgres and waits for the webhook before the response updates the client. The cached list is no longer invalidated.',
  trigger: { kind: 'user', label: 'User picks a list and clicks Add', nodeId: 'add-form' },
  systems: base.systems,
  nodes: [
    {
      ...node('add-form'),
      description: 'The form with the text field, a list picker and the Add button',
    },
    node('use-todos'),
    node('todos-api'),
    node('post-route'),
    node('todo-service'),
    {
      id: 'list-repository',
      kind: 'service',
      system: 'backend',
      label: 'ListRepository.exists',
      description: 'Checks that a list id exists',
      source: { file: 'backend/src/repositories/TodoRepository.ts', line: 20 },
    },
    node('todo-repository'),
    node('postgres'),
    node('todo-cache'),
    node('webhook'),
  ],
  edges: [
    { ...edge('submit'), payload: 'title, trimmed, and the selected listId' },
    { ...edge('create'), label: 'createTodo(title, listId)' },
    {
      ...edge('post'),
      payload: '{ "title": "Buy milk", "listId": 3 }',
      response:
        '201 { "id": 7, "title": "Buy milk", "listId": 3, "completed": false, "createdAt": "…" }',
    },
    {
      ...edge('route-to-service'),
      payload: 'Validated with zod: title 1 to 200 characters, listId optional positive integer',
    },
    {
      id: 'check-list',
      from: 'todo-service',
      to: 'list-repository',
      label: 'lists.exists(listId)',
      response: 'true, otherwise the service throws NotFound',
      source: { file: 'backend/src/services/TodoService.ts', line: 21 },
    },
    {
      id: 'select-list',
      tables: ['lists'],
      from: 'list-repository',
      to: 'postgres',
      label: 'SELECT 1 FROM lists',
      payload: 'WHERE id = $1',
      response: 'One row or none',
      source: { file: 'backend/src/repositories/TodoRepository.ts', line: 22 },
    },
    edge('service-to-repo'),
    {
      ...edge('insert'),
      payload: '(title, list_id) VALUES ($1, $2) RETURNING …',
    },
    {
      ...edge('notify'),
      label: 'await POST webhook',
      payload: '{ "text": "New todo in list 3: Buy milk" }',
      response: 'Awaited before the route responds',
    },
    edge('respond'),
    edge('set-state'),
  ],
  steps: [
    {
      edgeId: 'submit',
      description: 'The user picks a list, submits the form and the hook receives title and list.',
    },
    { edgeId: 'create', description: 'The hook calls the API client with both values.' },
    { edgeId: 'post', description: 'The client sends a POST with title and listId as JSON.' },
    {
      edgeId: 'route-to-service',
      description: 'The route validates the body, including the optional listId.',
    },
    { edgeId: 'check-list', description: 'The service asks whether the list exists.' },
    { edgeId: 'select-list', description: 'Postgres is queried for the list id.' },
    { edgeId: 'service-to-repo', description: 'The service asks the repository to save.' },
    {
      edgeId: 'insert',
      description: 'The row is written with its list id and comes back with an id.',
    },
    {
      edgeId: 'notify',
      description: 'The webhook is called and the service waits for the response.',
    },
    { edgeId: 'respond', description: 'The backend responds 201 with the new todo.' },
    {
      edgeId: 'set-state',
      description: 'The hook puts the todo first in the list and the form is cleared.',
    },
  ],
};

/** Namnet flödet efter ändringen sparas under, som reviewn pekar på. */
export const ADD_TODO_WITH_LIST_NAME = 'add-todo-to-a-list';

export const addTodoWithListCompare: FlowCompare = {
  baseLabel: 'main',
  headLabel: 'feature/todo-lists',
  base,
};

export const addTodoReview: Review = {
  title: 'Todo lists',
  summary:
    'Todos can be added to a list. The change validates the list at the route and the service, but drops the cache invalidation and waits for the webhook inside the request.',
  content: [
    '## What changes',
    '- The form gets a **list picker** and sends `listId` with the title',
    '- The route validates `listId` with the same schema as the title',
    '- The service checks that the list exists before inserting',
    '',
    '## What regresses',
    '- The cached list is **no longer invalidated** after a todo is added',
    '- The webhook is **awaited** before the response goes out',
    '- A list deleted mid-request turns into a 500 instead of a 404',
  ].join('\n'),
  baseLabel: 'main',
  headLabel: 'feature/todo-lists',
  flows: [ADD_TODO_WITH_LIST_NAME],
  findings: [
    {
      id: 'cache-not-invalidated',
      severity: 'error',
      title: 'The cached list is no longer invalidated',
      description:
        'create() used to call cache.invalidate() after the insert. That call is gone, so GET /api/todos keeps serving the old list from Redis for up to 60 seconds after a todo is added.',
      suggestion:
        'Call cache.invalidate() after repository.insert(), as setCompleted() and remove() still do.',
      fix: 'In TodoService.create (backend/src/services/TodoService.ts), add `await this.cache.invalidate();` directly after `this.repository.insert(input)`, before the webhook call. Verify: add a todo, then GET /api/todos returns it immediately instead of the cached list.',
      flow: ADD_TODO_WITH_LIST_NAME,
      nodeId: 'todo-service',
      source: { file: 'backend/src/services/TodoService.ts', line: 22 },
    },
    {
      id: 'webhook-awaited',
      severity: 'warning',
      title: 'The webhook is awaited inside the request',
      description:
        'notifyTodoCreated() is now awaited before the route responds. A slow or failing webhook delays or breaks the 201, even though the todo is already saved.',
      suggestion:
        'Keep the call fire-and-forget, or move it to a queue and let the response go out first.',
      fix: 'In TodoService.create, change `await notifyTodoCreated(todo)` back to `void notifyTodoCreated(todo)` so the route answers 201 without waiting. Keep the error logging inside notifyTodoCreated. Verify: with the webhook URL pointing at a slow server, POST /api/todos still answers at once.',
      flow: ADD_TODO_WITH_LIST_NAME,
      edgeId: 'notify',
      source: { file: 'backend/src/services/TodoService.ts', line: 24 },
    },
    {
      id: 'list-check-outside-transaction',
      severity: 'warning',
      title: 'The list check runs outside the insert',
      description:
        'The list is looked up in one query and the todo inserted in another. If the list is deleted in between, the foreign key on todos.list_id rejects the insert and the route answers 500 instead of 404.',
      suggestion:
        'Rely on the foreign key and map its error to 404, or run the check and the insert in one transaction.',
      flow: ADD_TODO_WITH_LIST_NAME,
      edgeId: 'check-list',
      source: { file: 'backend/src/services/TodoService.ts', line: 21 },
    },
    {
      id: 'list-id-validated',
      severity: 'info',
      title: 'listId is validated at the route',
      description:
        'The optional listId is checked by the zod schema before it reaches the service, so a malformed id is rejected with 400 like the title.',
      flow: ADD_TODO_WITH_LIST_NAME,
      edgeId: 'route-to-service',
      source: { file: 'backend/src/routes/todos.ts', line: 22 },
    },
  ],
};
