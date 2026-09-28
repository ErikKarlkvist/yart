import { type Flow } from '../flow';
import { type FlowCompare, type Review } from '../review';
import { addTodoFlow } from './add-todo';
import {
  ADD_TODO_WITH_LIST_NAME,
  addTodoReview,
  addTodoWithListCompare,
  addTodoWithListFlow,
} from './add-todo-review';
import { listTodosFlow } from './list-todos';

/** En inbyggd analys: ett flöde, med jämförelsen mot base när det beskriver en ändring, eller en review. */
export type DemoAnalysis =
  | { kind: 'flow'; name: string; flow: Flow; compare?: FlowCompare }
  | { kind: 'review'; name: string; review: Review };

/** Alla fixturer, pekar på demo/todo-app. */
export const demoFlows: readonly Flow[] = [addTodoFlow, listTodosFlow, addTodoWithListFlow];

/** De inbyggda analyserna i den ordning de visas. */
export const demoAnalyses: readonly DemoAnalysis[] = [
  { kind: 'flow', name: 'add-todo', flow: addTodoFlow },
  { kind: 'flow', name: 'list-todos', flow: listTodosFlow },
  {
    kind: 'flow',
    name: ADD_TODO_WITH_LIST_NAME,
    flow: addTodoWithListFlow,
    compare: addTodoWithListCompare,
  },
  { kind: 'review', name: 'todo-lists', review: addTodoReview },
];

/** Sökväg till demo-repot relativt Reverik-roten. */
export const DEMO_REPO_RELATIVE_PATH = 'demo/todo-app';

export { addTodoFlow, addTodoReview, addTodoWithListCompare, addTodoWithListFlow, listTodosFlow };
