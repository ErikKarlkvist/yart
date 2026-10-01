# yart-app

yart (yet another review tool): Electron-app som visar dataflöden i en kodbas som
animerade sekvensdiagram, med dokument och reviewer som pekar in i dem. Namnet står i
`APP_NAME` i `src/common/model/brand.ts`; texter som når modellen tar det via `brandText`.
Sparad data, MCP-servern och skillen heter `yart`. Data från tiden som Reverik flyttas
från den gamla datamappen vid start (`src/application/main/index.ts`).

## MCP och agenter

Appen har ingen egen AI. Agenter levererar flöden, dokument och reviewer via MCP-servern
som appen startar på `http://127.0.0.1:7390/mcp` (`src/features/mcp/`). Verktygens
JSON-scheman kommer från zod-schemana i `src/common/model/`, så beskrivningar där är
dokumentation för modellen. Skillen byggs i `src/features/analysis/model/skill.ts`,
serveras som MCP-resurs och installeras från panelen Connect.

Panelen Agent kör en headless agentsession per konversation (`src/features/agent/`).
Claude Code körs som en långlivad `claude -p` med strömmande JSON på stdin och stdout;
Codex som `codex exec --json` per fråga som återupptar tråden. Båda får appens MCP-server
som enda server, skillen och lägets instruktioner
(`src/features/agent/model/conversationInstructions.ts`), och har skrivrätt i repot.

- Läget under textrutan styr godkännanden: Allow edits (filändringar utan att fråga,
  `acceptEdits` / Codex utan frågor i sandlådan), Allow all (`bypassPermissions` / Codex
  `danger-full-access`) och Manual. Claude Code frågar via MCP-verktyget
  `permission_prompt` och frågan visas i panelen med Allow och Deny.
- Agenten namnger konversationen via `name_conversation`. Båda verktygen finns bara för
  appens egna sessioner, som ansluter med `?conversation=<id>` i MCP-adressen. Det som
  sparas i en konversation får dess id, och analyslistan grupperar på det.
- Modellerna och effort-nivåerna hämtas från den installerade Claude Code via
  `initialize` i stream-json (`src/features/agent/main/models.ts`).
- I Analyse, Review och Plan ska svaret sparas i appen, inte skrivas i chatten. Varje
  fråga får en dold påminnelse, och sparas inget under en tur skickar appen en påminnelse.

Guiden vid första starten väljer mellan Claude Code, Codex och extern AI. Externa agenter
levererar via MCP som vanligt.

## Innehåll: kort för människor, detaljer för AI

Dokument och reviewer skrivs som kort markdown med rubriker och punktlistor
(`src/common/model/markdown.ts`). Det en agent behöver ligger i egna fält som inte visas:
`plan` på dokument och `fix` på fynd. Ur dem och flödena byggs implementationsplanen och
fix-planen som kopieras eller skickas till agenten (`src/features/analysis/model/plan.ts`).
Flöden har en `trigger`, det som startar dem, som ritas på startnoden.

## Design

Appen har ett enda, mörkt tema: Ink. Läs `docs/design/STYLEGUIDE.md` innan du ändrar eller
lägger till UI. Där står reglerna (raka hörn, hårda skuggor, mono-etiketter, färgernas
roller), vilka knapp- och listklasser som redan finns och var appen medvetet avviker från
ritningen. Värdena finns bara i `src/application/renderer/palette.css`; hårdkoda inga färger.
Ritningen av huvudfönstret ligger i `docs/design/reference/main-window.dc.html`.

## Kommandon

- `npm run dev` startar appen med hot reload
- `npm run check` kör typecheck, lint, format-check och test, samma som CI bör köra
- `npm run test` kör Vitest
- `npm run unused` kör knip och listar oanvända filer, exporter och beroenden (demo-appen ignoreras)
- Renderern går att titta på i en vanlig webbläsare medan `npm run dev` kör: öppna
  Vite-adressen som skrivs ut. Då laddas `src/application/renderer/mockBridge.ts`
  i stället för preload-bryggan och svarar med demo-repot och fixturerna.
  `npm run dev -- --rendererOnly` startar bara Vite utan Electron, samma sak finns
  som `renderer` i `.claude/launch.json` i repots rot.
- Riktig Electron går att felsöka utifrån: `YART_DEBUG_PORT=9333 npm run dev` öppnar
  DevTools-protokollet på porten. `YART_USER_DATA=<mapp>` ger instansen en egen datamapp,
  så en testinstans kan köras bredvid den vanliga. Kör då med `--outDir` till en annan mapp
  inuti projektet, annars hittar main inte `node_modules`. `YART_MCP_PORT=<port>` låser
  MCP-servern till en port; annars tar den första lediga från 7390 och uppåt.

Pre-commit-hooken (husky + lint-staged) kör eslint --fix och prettier på staged filer,
sedan `tsc -b` och testerna. Hookarna ligger i `.husky/` i repots rot, där commit-msg kräver
engelska meddelanden utan AI-attribution. Committa inte med `--no-verify`.

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
Views i fönsterraden, och fäller ihop dockorna med knapparna där. En flik kan stängas helt;
panelen minns sin docka och öppnas där igen från Views eller när appen visar den. Layouten sparas i `yart.layout` och delas
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
