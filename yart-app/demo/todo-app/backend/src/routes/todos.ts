import { Router } from 'express';
import { z } from 'zod';
import { TodoService } from '../services/TodoService';

const newTodoSchema = z.object({ title: z.string().trim().min(1).max(200) });
const patchTodoSchema = z.object({ completed: z.boolean() });

export function todosRouter(service = new TodoService()): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const todos = await service.list();
    res.json(todos);
  });

  router.post('/', async (req, res) => {
    const parsed = newTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'title krävs' });
      return;
    }
    const todo = await service.create(parsed.data);
    res.status(201).json(todo);
  });

  router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const parsed = patchTodoSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      res.status(400).json({ error: 'ogiltig begäran' });
      return;
    }
    const todo = await service.setCompleted(id, parsed.data.completed);
    if (!todo) {
      res.status(404).json({ error: 'finns inte' });
      return;
    }
    res.json(todo);
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const removed = await service.remove(id);
    res.status(removed ? 204 : 404).end();
  });

  return router;
}
