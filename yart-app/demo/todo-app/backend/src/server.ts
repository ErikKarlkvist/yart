import express from 'express';
import { todosRouter } from './routes/todos';

const app = express();
app.use(express.json());
app.use('/api/todos', todosRouter());

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`todo-backend lyssnar på http://localhost:${port}`);
});
