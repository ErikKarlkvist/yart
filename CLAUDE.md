# yart

yart, yet another review tool. Repot har en mapp per del:

- `yart-app/` är Electron-appen. Kommandon, arkitektur, kodstil och design står i
  `yart-app/CLAUDE.md`; alla npm-kommandon körs i den mappen.
- En webbplats för att dela diagram kommer senare i en egen mapp bredvid.

Husky-hookarna ligger i `.husky/` i roten. Pre-commit kör appens kontroller i `yart-app/`,
commit-msg avvisar meddelanden som ser svenska ut och AI-attribution.

## Commits

- Commitmeddelanden skrivs på engelska.
- Ingen `Co-Authored-By` eller "Generated with Claude" i commits eller PR:er.
