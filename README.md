# Reverik

PoC: en Electron-app som visar dataflöden i en kodbas som animerade
sekvensdiagram, med dokument och reviewer som pekar in i dem.

Appen har ingen egen AI. Man öppnar ett lokalt repo i appen och kör valfri
AI-agent fristående, till exempel Claude Code i en terminal. Agenten kopplas
till Reveriks MCP-server och levererar flöden, dokument och reviewer med dess
verktyg; appen validerar dem, kontrollerar att varje nod och anrop pekar på en
fil och rad som finns, och ritar upp resultatet.

```bash
claude mcp add --transport http reverik http://127.0.0.1:7390/mcp
```

Första starten visar en guide där man väljer agent: Claude Code, Codex eller
annan. Den ger kommandot att köra, installerar en skill i agentens skillmapp,
eller kopierar guiden som text för agenter utan skillmapp. Samma sak finns i
Anslut-panelen bakom MCP-adressen i sidfoten. Agenten anger repots rot i varje
anrop, så den kan köras från vilken mapp som helst. Äldre versioner skapade en
mapp `.reverik/` i repot; den används inte längre och kan tas bort.

I `demo/todo-app` finns en liten app att analysera: React-frontend,
Express-backend, Postgres och Redis, med inbyggda analyser och en demo-review.

## Kom igång

```bash
npm install
npm run dev
```

Ingen API-nyckel behövs, agenten använder sin egen inloggning.
Se CLAUDE.md för kommandon, arkitektur och kodstil.
