# Stilguide: Ink

yart har ett enda tema, **Ink**: mörkt, neutral svart bas, en klar limegrön accent med mörk
text på, raka hörn och JetBrains Mono för allt strukturellt. Läs den här filen innan du
ändrar eller lägger till UI. Nya komponenter ska se ut som om de alltid funnits här.

## Källor

- `src/application/renderer/palette.css`: alla färger, typsnitt och radien som
  CSS-variabler. **Enda källan för värden.** Hårdkoda aldrig färger i komponenternas CSS,
  använd variablerna.
- `reference/main-window.dc.html`: huvudfönstret som designen ritades, 1600×960. Facit för
  hur delarna ser ut tillsammans. Öppna i en webbläsare (behöver `support.js` bredvid,
  typsnitt och ikoner hämtas från nätet).
- `reference/design-language.dc.html`: utforskningen bakom språket, omgång 1–5. Omgång 5a
  valdes; nodfärgerna har därefter gjorts klarare. Bara bakgrund, inte facit.

Referensfilerna är HTML-skisser, inte produktionskod. Appen bygger samma sak med sina egna
mönster: variabler i `palette.css`, BEM-klasser i respektive features `*.css`, ikoner via
`common/renderer/Icon.tsx` och texter via `en-gb.json`.

## Grundregler

- **Bara mörkt.** Inget ljust tema, ingen temaväljare, inga `prefers-color-scheme`- eller
  `data-theme`-block. Fönstret sätts mörkt i `src/application/main/window.ts`.
- **Raka hörn.** `border-radius: var(--radius)` (0) överallt: knappar, fält, flikar,
  noder, popovers, taggar. Undantag: små statusprickar.
- **Hårda skuggor.** Bara offset utan blur: `4px 4px 0 rgb(0 0 0 / 50%)` på popovers och
  menyer, `4px 4px 0` med 30 % av nodfärgen på aktiv nod. Ingen glow, ingen drop-shadow.
- **Färgblandning i oklch:** `color-mix(in oklch, …)`.
- **Accenten** (`--accent`) har alltid `--on-accent` (mörk) text när den är fylld.
- **Typsnitt** ligger lokalt via `@fontsource` (importeras i `main.tsx`), aldrig från
  Google Fonts.
- **Bara befintliga animationer.** Övergångar på opacity/border 200 ms, splitter 120 ms.
  Det enda rörliga är strecken på den aktiva kanten.

## Färger

| Roll   | Variabel                                          | Används till                                    |
| ------ | ------------------------------------------------- | ----------------------------------------------- |
| Bas    | `--bg` `#0a0a0a`                                  | innehåll, dockornas kropp, vald flik            |
| Panel  | `--bg-panel` `#121212`                            | flikrader, kort, kodblock, compose, uppspelning |
| Hover  | `--bg-hover` `#1b1b1b`                            | hover och vald rad                              |
| Rutnät | `--grid` `#161616`                                | grafens bakgrund                                |
| Linjer | `--border` `#262626`, `--border-strong` `#383838` | avdelare; ramar på knappar, fält, noder         |
| Text   | `--fg`, `--fg-body`, `--fg-muted`, `--fg-faint`   | rubrik/aktiv, löptext, etiketter, radnummer     |
| Status | `--ok` (= accent), `--warn`, `--danger`, `--plan` | fynd, ändringar, lägen                          |
| Noder  | `--node-*`                                        | nodtypens färg, sätts som `--node-color`        |

Lägen: Analyse = accent, Review = warn, Plan = plan. Ändringar: added = ok, changed = warn,
removed = danger. Allvarsgrad: error = danger, warning = warn, info = accent.

## Typografi

Sans (`--font-sans`, IBM Plex Sans) för löptext: 14 bas, 13 i paneler, 12 för hjälptext.

Mono (`--font-mono`, JetBrains Mono) för allt strukturellt. Mönstret "mono-etikett":

```css
font-family: var(--font-mono);
font-size: 11px; /* 10px nodtyp och grupprubrik, 9px taggar */
text-transform: uppercase;
letter-spacing: 0.06em; /* 0.04em på knappar, 0.08em på grupprubriker */
```

Storlekar i mono: 18/700 titel, 14/500 systemnod, 13/500 detaljnod, 12 kod och räknare,
11 flikar/knappar/meta, 10 nodtyp och kantetikett, 9 taggar.

## Byggklossar

Klasserna finns redan; återanvänd dem innan du skriver nya.

| Klass                | Vad                                                                   |
| -------------------- | --------------------------------------------------------------------- |
| `.button`            | sekundär: höjd 30, `--border-strong`, transparent, mono 12 versaler   |
| `.button--primary`   | primär: fylld accent, `--on-accent`, mono 12 700 versaler, ingen kant |
| `.icon-button`       | 30×30 med kant; `--primary` accentkant, `--quiet` utan kant och muted |
| `.text-button`       | mono 11, muted, gemener, understruken                                 |
| `.count-badge`       | fyrkantig siffra med `--border-strong`                                |
| `.tab`, `.tab--caps` | flikar; appflikar får "›" och dockflikar `[ TITEL ]` via CSS          |

Hover på allt med kant: `border-color: var(--accent)`. `:disabled` har opacity 0.4. Fokus
på fält: accentkant, ingen outline.

Återkommande mönster:

- **Vald rad i en lista:** `background: var(--bg-hover); box-shadow: inset 2px 0 0 var(--accent)`,
  gärna med en "›" i accent före som har tom plats på övriga rader.
- **Taggar:** mono 9–10px 700, padding `1px 4–5px`. Antingen kontur (kant och text i
  färgen) eller fylld (bakgrund i färgen, text `--bg`). Fylld används för allvarsgrad.
- **Fyndräknare:** `E{n}`, `W{n}`, `I{n}` efter värsta allvarsgrad (`review.count.*`),
  taggar `ERR`/`WARN`/`INFO` (`review.tag.*`).
- **Grupperade knappar** (uppspelning, lägen, agentväljare): en gemensam ram runt gruppen,
  1px avdelare mellan, vald knapp fylld.
- **Popovers och menyer:** `--bg-panel`, `1px solid var(--border-strong)`, hård skugga.
- **Svar och loggrader:** `--bg-panel` med `border-left: 2px solid` i accent (eller danger
  vid fel).
- **Text som inte är översättning** (`›`, `[ ]`, `$`, `↵`, `+`/`~`/`−` på ändringar) läggs
  med `::before`/`::after` i CSS, inte i JSX. Allt annat går via `t()`.

## Grafen

- Noder är kort: `--bg-panel`, `1px solid var(--border-strong)`, rubrikrad (ikon 9px,
  typnamn, högerställt antal noder eller ändring) i `--node-color`, kropp i mono.
- Aktiv nod: kant i `--node-color`, rubrikraden fylld med `--node-color` och text `--bg`,
  hård skugga. Väntande noder opacity 0.55.
- Kanter vilar i `--fg-muted` 1.5px; väntande opacity 0.35; aktiv i accent 2px med
  `stroke-dasharray: 6 4` som rör sig. Pulsen är en cirkel r 4 utan skugga.
- Kantetiketter: `--bg`, `1px solid var(--border)`, mono 10, nollutfyllt stegnummer före.
- Fyndflaggan sitter i nodens övre högra hörn; hoverknapparna (18×18 fyrkanter) flyttas åt
  vänster när en flagga finns.
- Uppspelning: knappgrupp, ett segment per steg (spelade i accent), räknare `03/10`.

## Avvikelser från ritningen

Medvetna skillnader mellan `reference/main-window.dc.html` och appen:

- Agentpanelens konversationsval och lägesknappar ligger nedtill vid textrutan, inte överst.
- Dockflikar visar ingen räknare (t.ex. antal fynd på Review); paneltitlar är bara text.
- Startpunkten ritas som `▶ {kind}: {label}` med flödets egen etikett.
