# yart

PoC: en Electron-app som visar dataflöden i en kodbas som animerade
sekvensdiagram, med dokument och reviewer som pekar in i dem.

Appen har ingen egen modell och ingen API-nyckel. Man öppnar ett lokalt repo
och ställer frågor i panelen Agent, eller klickar på en nod i ett flöde. Appen
kör Claude Code eller Codex i bakgrunden med användarens egen inloggning, och
agenten levererar flöden, dokument och reviewer genom yarts MCP-verktyg.
Appen validerar dem, kontrollerar att varje nod och anrop pekar på en fil och
rad som finns, och ritar upp resultatet.

Vill man hellre köra en agent i sin egen terminal kopplas den till samma
MCP-server, för Claude Code med:

```bash
claude mcp add --transport http yart http://127.0.0.1:7390/mcp
```

Första starten visar en guide med de tre vägarna: Claude Code, Codex eller
extern AI. Den kontrollerar att vald CLI finns och är inloggad, och kan
installera en skill som lär agenten när och hur yart används. Guiden nås
igen med Guide i sidfoten. Agenten anger repots rot i varje anrop, så den
kan köras från vilken mapp som helst.

Namnet, yet another review tool, styrs av `APP_NAME` i `src/common/model/brand.ts`.

I `demo/todo-app` finns en liten app att analysera: React-frontend,
Express-backend, Postgres och Redis, med inbyggda analyser och en demo-review.

## Kom igång

```bash
npm install
npm run dev
```

Ingen API-nyckel behövs, agenten använder sin egen inloggning.
Se CLAUDE.md för kommandon, arkitektur och kodstil.
