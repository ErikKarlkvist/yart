# Reverik

PoC: Electron-app som visar dataflöden i en kodbas som animerade sekvensdiagram.
Appen har ingen egen AI. En agent (Claude Code eller annan) körs fristående och
levererar flöden, dokument och reviewer via MCP-servern som appen startar på
`http://127.0.0.1:7390/mcp` (`src/features/mcp/`). Verktygens JSON-scheman kommer
från zod-schemana i `src/common/model/`, så beskrivningar där är dokumentation för
modellen. Skillen för Claude Code, som också serveras som MCP-resurs, byggs i
`src/features/analysis/model/skill.ts` och installeras från appens Anslut-panel.
Frågor från grafen, reviewuppdrag och panelen Agent går till en headless agentsession
som appen kör per repo (`src/features/agent/`). Claude Code körs som en långlivad
`claude -p` med strömmande JSON på stdin och stdout; Codex som `codex exec --json` per
fråga som återupptar tråden. Båda får Reveriks MCP-server som enda server och skillen
som instruktioner, och bara läs- och leveransverktyg är tillåtna. Guiden vid första
starten väljer mellan Claude Code, Codex och extern AI, och valet styr vad appen kör. Svaren visas i panelen och
det agenten sparar landar i listan. Går sessionen inte att starta visas felet med
prompten att kopiera. Externa agenter kan fortfarande leverera via MCP.

## Kommandon

- `npm run dev` startar appen med hot reload
- `npm run check` kör typecheck, lint, format-check och test, samma som CI bör köra
- `npm run test` kör Vitest
- `npm run unused` kör knip och listar oanvända filer, exporter och beroenden (demo-appen ignoreras)
- Renderern går att titta på i en vanlig webbläsare medan `npm run dev` kör: öppna
  Vite-adressen som skrivs ut. Då laddas `src/application/renderer/mockBridge.ts`
  i stället för preload-bryggan och svarar med demo-repot och fixturerna.
  `npm run dev -- --rendererOnly` startar bara Vite utan Electron, samma sak finns
  som `renderer` i `.claude/launch.json`.
- Riktig Electron går att felsöka utifrån: `REVERIK_DEBUG_PORT=9333 npm run dev` öppnar
  DevTools-protokollet på porten. `REVERIK_USER_DATA=<mapp>` ger instansen en egen datamapp,
  så en testinstans kan köras bredvid den vanliga. Kör då med `--outDir` till en annan mapp
  inuti projektet, annars hittar main inte `node_modules`. `REVERIK_MCP_PORT=<port>` låser
  MCP-servern till en port; annars tar den första lediga från 7390 och uppåt.

Pre-commit-hooken (husky + lint-staged) kör eslint --fix och prettier på staged filer,
sedan `tsc -b` och testerna. Committa inte med `--no-verify`.

## Arkitektur: feature slicing

```
src/
  application/   ihopkoppling. main/ (Electron-entry, fönster), preload/, renderer/ (App, layout), ipc/
  common/        delat och beroendefritt gentemot features. model/, ipc/, main/, renderer/
  features/      en mapp per feature, se src/features/README.md
```

Samma lagernamn överallt: `model` och `ipc` är rena och körs i båda processerna,
`main` är node-sidan, `renderer` är React-sidan. Gränserna upprätthålls av
eslint-plugin-boundaries i eslint.config.js. Om lintern klagar på en import är det
arkitekturen som säger nej, inte lintern som är fel.

## Paneler och dockor

Allt utom huvudytan i mitten är en panel som ligger i en av tre dockor: vänster, höger
eller nederkant. Användaren drar flikar mellan dockorna, högerklickar eller använder menyn
Views i fönsterraden, och fäller ihop dockorna med knapparna där. Layouten sparas i `reverik.layout` och delas
av alla appflikar. Mekaniken är generisk och ligger i `src/features/layout/` (ren logik i
`model/dock.ts`). Vilka paneler som finns och var de ligger från början står i
`src/application/renderer/panels.tsx`: en ny panel är ett id, en plats i `DEFAULT_LAYOUT`
och en definition i `usePanels`. Kod som vill visa en panel anropar `reveal(id)` från
`useDock()` i stället för att veta vilken docka den ligger i.

## IPC

Kanaler definieras med `defineChannel<Req, Res>('feature:namn')` i en features `ipc/`,
hanteras i main med `handleChannel` från `@/common/main/ipc` och anropas i renderer med
`invokeChannel` från `@/common/renderer/ipc`. Händelser från main definieras med `defineEvent`,
skickas med `emitEvent` och lyssnas på med `useIpcEvent`. Preload exponerar bara
`window.api.invoke` och `window.api.on`.

## Kodstil

- TypeScript strict med `noUncheckedIndexedAccess` och `exactOptionalPropertyTypes`
- Explicita returtyper på exporterade funktioner
- `import { type X }` för typimporter
- Ingen `console.log` i committad kod, `console.warn`/`error` är ok
- UI-texter och felmeddelanden som når användaren eller modellen ligger i
  `src/common/model/i18n/en-gb.json` och hämtas med `t('nyckel')`. Aldrig inline-strängar i JSX.
  Kommentarer på svenska, identifierare på engelska
