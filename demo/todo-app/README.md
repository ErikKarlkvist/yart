# Demo: todo-app

En liten men realistisk todo-app som Yart kan analysera. Den är inte en del av
Yart-appen utan ett målrepo. Välj mappen `demo/todo-app` som repo i Yart.

```
frontend/   React + Vite. Formulär och lista, hook som pratar med API:t.
backend/    Express. Routes -> TodoService -> TodoRepository (Postgres) och TodoCache (Redis).
            Nya todos skickas också till en webhook (externt system).
```

Flöden som är intressanta att fråga om:

- "Vad händer när man lägger till en todo?" Går hela vägen till Postgres, invaliderar cachen och pingar webhooken.
- "Vad händer när listan laddas?" Läser från Redis, går till Postgres vid miss och fyller cachen.
- "Vad händer när man bockar av en todo?"

Appen går att köra på riktigt med `docker compose up` för Postgres och Redis, men
det behövs inte för analysen.
