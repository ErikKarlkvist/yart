# Features

Varje feature är en egen mapp med samma inre struktur. Lagren är obligatoriska
namn, lintern flaggar filer utanför dem.

```
features/<namn>/
  index.ts        publikt API för renderer-sidan (komponenter, hooks)
  model/          rena typer, zod-scheman, logik. Inga electron/react/node-importer.
  ipc/            kanaldefinitioner via defineChannel. Rent, delas av main och renderer.
  main/           handlers och tjänster som körs i Electrons main-process.
                  index.ts exporterar register<Namn>Handlers().
  renderer/       React: components/, hooks/, state.
```

Regler:

- En feature får importera `common` och sig själv, samt andra features via deras `index.ts`.
- `renderer` får aldrig importera `main` och tvärtom. `model` och `ipc` får inte importera någotdera.
- `application` kopplar ihop: main registrerar handlers från varje `features/*/main`,
  renderer monterar komponenter från varje `features/*/index.ts`.
