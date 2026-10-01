import type { Todo } from '../types';

const WEBHOOK_URL = process.env.TODO_WEBHOOK_URL;

/** Skickar nya todos till ett externt system, t.ex. en Slack-kanal. Fel loggas bara. */
export async function notifyTodoCreated(todo: Todo): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Ny todo: ${todo.title}` }),
    });
  } catch (error) {
    console.error('Webhook misslyckades', error);
  }
}
