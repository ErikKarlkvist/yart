# Reverik

PoC: Electron-app som visar dataflöden i en kodbas som animerade sekvensdiagram.
Appen har ingen egen AI. En agent (Claude Code eller annan) körs fristående och
levererar flöden, dokument och reviewer via MCP-servern som appen startar på
`http://127.0.0.1:7390/mcp` (`src/features/mcp/`). Verktygens JSON-scheman kommer
från zod-schemana i `src/common/model/`, så beskrivningar där är dokumentation för
modellen. Den äldre vägen, JSON till `.reverik/` i repot som appen bevakar, och
terminalpanelen finns kvar tills MCP-vägen är beprövad. Guiden byggs i
`src/features/analysis/model/guide.ts`.

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
  `node-pty` är ett native-modul med prebuilds. npm tappar körrättigheten på dess
  `spawn-helper`, så `postinstall` kör `scripts/fix-node-pty.mjs` som rättar det.

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
