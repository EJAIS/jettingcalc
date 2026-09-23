# Dellorto Jetting Calculator – WebApp

Diese Datei enthält Regeln, Entscheidungen mit Begründung und Verweise auf die
jeweils maßgebliche Datei — **keine Kopien von Code**. Wo eine Aussage und der
Code auseinanderlaufen, gilt der Code; die Aussage hier wird korrigiert.

## Projektübersicht

- **Zweck:** Web-Portierung und Weiterentwicklung des Excel-Tools
  *"Calculate Jetting for Dellorto Carbs v1.5"*: Jetting-Rechner für
  Dellorto-Vergaser (VHSx, dazu PHBH und PHBL als Beta) mit bis zu 5
  parallelen Setups, Diagrammen, Custom Needles, Share-Links und
  Nadelkatalog.
- **Stack:** reines HTML/CSS/JavaScript (ES-Module), kein Build-Tool, kein
  Framework, keine Laufzeit-Abhängigkeiten aus dem Netz (Chart.js liegt
  vendored unter `js/vendor/`). `package.json` existiert nur für die
  optionalen Playwright-Browsertests.
- **PWA / offline:** Service Worker (`sw.js`) + `manifest.json`; nach dem
  ersten Laden vollständig offline nutzbar (siehe Abschnitt
  „PWA / Service Worker“).
- **Deployment:** statisch, in einem Unterverzeichnis von ejais.de
  (ejais.de/jettingcalc). Deshalb sind alle Pfade in `index.html`,
  `manifest.json` und `sw.js` relativ. Details zu Server-Headern: README,
  Abschnitt „Deployment“.
- **Lizenz:** GPL-2.0, da Portierung eines GPL-2.0-Werks (siehe
  „Copyright & Attribution“ und `LICENSE`).

---

## Language

### Code, documentation & comments
All code comments, function/variable names, README, and inline documentation
are written in **English** without exception.

### UI — bilingual EN / DE
The app UI supports two languages: English (EN, default) and German (DE).
Every visible string in the UI must be available in both languages.

Rules for all future UI implementations:
- Never hardcode visible text strings in HTML or JS
- Every UI string goes into `js/i18n.js` under both `en` and `de` keys
- Use `t('key')` to retrieve the current language string in JS
- Use `data-i18n="key"` on HTML elements for static text content
- Use `data-i18n-placeholder="key"` for input placeholder attributes
- Use `data-i18n-title="key"` for tooltip/title attributes
- After any dynamic DOM update that adds translatable text, call
  `applyTranslations()` from i18n.js
- Chart axis labels and legends must also go through `t('key')` —
  re-render charts on language change

### Language storage
- localStorage key: `dellorto_lang`
- Values: `'en'` (default) | `'de'`
- Toggle button shows the TARGET language (clicking EN shows DE and vice versa)
- `document.documentElement.lang` is updated on every language change

---

## Dateistruktur

```
index.html                  Haupt-UI: Rechner- und Katalog-Ansicht, Dialoge, Nadel-Schema-<template>, Footer
manifest.json               PWA-Manifest (relative start_url/scope)
sw.js                       Service Worker: Precache, Cache-first, Share-Links network-first
css/style.css               Styling inkl. Dark Mode (CSS-Variablen)
js/app.js                   UI-Logik, Event-Handling, Ansichten, Share-UI, Katalog-UI
js/calc.js                  Berechnungs-Engine (calcSetup)
js/needledb.js              Statische Nadeldatenbank + Stammdaten (Längen, Clip-Geometrie, Düsen, Bohrungen)
js/storage.js               localStorage-Abstraktion (Setups, Custom Needles, Vergasertyp)
js/charts.js                Chart.js-Diagramme (Needle Profile, Carb Profile, Vollbild-Modal)
js/cutaway.js               Schieber-Ausschnitt-Empfehlung für 2-Takt-Rundschieber
js/share.js                 Share-Links kodieren/dekodieren (rein, ohne DOM/localStorage)
js/needlecatalog.js         Nadelkatalog: Zeilen, Filter, Sortierung, Formatierung (rein)
js/i18n.js                  EN/DE-Übersetzungen, t(), applyTranslations()
js/vendor/                  Vendored Chart.js (Version und Herkunft: js/vendor/README.md)
icons/                      PWA-Icons
scripts/                    sync-sw-cache-version.mjs — erzeugt JETTINGCALC_CACHE_VERSION
.githooks/                  pre-commit-Hook, der das Skript oben ausführt
test/                       Unit-Tests (node --test, ohne Abhängigkeiten)
test-browser/               Playwright-Browsertests (pwa.mjs, catalog.mjs)
original/                   Unveränderte Original-Excel (siehe „Copyright & Attribution“)
README.md                   Nutzer- und Entwicklerdoku (Features, Deployment, Tests)
TESTING.md                  PWA-Audit, Browsertests, manuelle Checkliste
KONSTANTEN_VERIFIKATION.md  Verifikationsstand aller Konstanten und Messwerte
```

---

## Maßgebliche Quellen

| Thema | Maßgebliche Datei |
|---|---|
| Nadeldaten (A–F, `carbType`, `clips`, `length`), Nadellängen, Clip-Geometrie, Düsen- und Bohrungsgrößen | `js/needledb.js` |
| Formeln (Leerlaufposition, Durchmesser, HD-Äquivalent, Overall-Kennlinie, maxHD) | `js/calc.js` |
| Konstanten, Messwerte, Messbedingungen und Verifikationsstand | `KONSTANTEN_VERIFIKATION.md` |
| Referenz- und Regressionswerte | `test/*.test.mjs` |
| Nutzerseitige Feature-Beschreibung | `README.md` |

**Datenquellen-Hierarchie** (bei Widersprüchen gewinnt die höhere Quelle):
offizielle Dellorto-Datenblätter (PDF) > Eurocarb-Spezifikation (2015) >
Stein-Dinse Dellorto-Handbuch > Community-Quellen. Jede Datenkorrektur wird
mit Quelle in `KONSTANTEN_VERIFIKATION.md` festgehalten.

---

## localStorage

| Key | Inhalt | Lesen/Schreiben |
|---|---|---|
| `dellorto_setups` | Array der Setup-Slots | `loadSetups()` / `saveSetups()` (`storage.js`) |
| `dellorto_custom_needles` | Array der Custom Needles | `loadCustomNeedles()` / `saveCustomNeedles()` |
| `dellorto_carb_type` | globaler Vergasertyp des Rechners (`VHSx` \| `PHBH` \| `PHBL`), Default `VHSx` | `loadCarbType()` / `saveCarbType()` |
| `dellorto_lang` | `'en'` (Default) \| `'de'` | `i18n.js` |
| `darkMode` | `'1'` \| `'0'` | Dark-Mode-Toggle in `app.js` |

**Regeln für `dellorto_setups`:**
- Immer genau 5 Slots mit `id` 1–5. Felder je Slot: `id`, `name`,
  `needleType`, `clipPos`, `carbSize`, `needleJet`, `jetType`, `nd`, `hd`.
  Ein leerer Slot hat `null` in allen Feldern außer `id` und `name`
  (Default-Name `#<id>`).
- `nd` (Leerlaufdüse) und `hd` (Hauptdüse) sind Benutzereingaben.
  Berechnete Werte (z. B. maxHD) werden nie gespeichert, sondern bei Bedarf
  neu berechnet.
- Ohne gespeicherte Daten liefert `loadSetups()` eine frische Kopie der fünf
  leeren Default-Slots.
- **Bereinigung beim Laden:** `loadSetups()` setzt ein gespeichertes
  `clipPos`, das größer ist als die Clip-Anzahl der Nadel (eigener
  `clips`-Wert der Nadel inkl. Custom Needles, sonst `getClipCount()`),
  still auf `null` und speichert das Ergebnis einmalig zurück. Grund:
  Clip-Anzahlen je Nadel sind jünger als manche gespeicherten Setups.
- Eine Vergasertyp-Umstellung im Rechner (`handleCarbTypeChange()`) setzt
  unpassende `needleType` (inkl. `clipPos`), `jetType` und `carbSize` zurück
  und wählt bei nur einem möglichen Mischrohr dieses automatisch aus.

**UI-Zustand, der bewusst NICHT persistiert wird:** `catalogState`
(Nadelkatalog) und der Undo-Snapshot eines Share-Imports (`importUndo`).

---

## Nadeldatenbank – needledb.js

`NEEDLE_DB` ist schreibgeschützt; Custom Needles liegen getrennt in
localStorage (siehe „Custom Needles“).

**Felder je Nadel:**
- `carbType` — Vergaserfamilie (`VHSx`, `PHBH`, `PHBL`); steuert Filterung
  in Dropdowns, Katalog und Share-Validierung sowie `minExposed` in der
  Berechnung.
- `A` Schaft-Ø, `B` Spitzen-Ø, `C` Beginn Taper 1 ab Spitze — Pflicht.
- `D` Ø am Übergang Taper 1/2 und `E` Beginn Taper 2 ab Spitze — nur bei
  2- und 3-Taper-Nadeln, immer gemeinsam.
- `F` Länge des zylindrischen Spitzenstücks — nur bei 3-Taper-Nadeln.
- `clips` — Anzahl Clip-Nuten, wo je Nadel belegt.
- `length` — optionaler Längen-Override (z. B. X37); sonst gilt
  `NEEDLE_LENGTHS` nach Namenspräfix (`getNeedleLength()`).

**Clip-Anzahl:** `getClipCount()` nimmt den `clips`-Wert der Nadel, sonst
`DEFAULT_CLIPS_BY_PREFIX` nach Präfix. Welche Präfix-Defaults physisch
verifiziert sind, steht in `VERIFIED_DEFAULT_CLIP_PREFIXES` (derzeit nur D);
die übrigen Defaults sind Platzhalter. Aufrufer, die auch Custom Needles
kennen, prüfen zuerst deren eigenes `clips` (`resolveClipCount()` in
`app.js`).

**Weitere Stammdaten in `needledb.js`:** `CLIP_GEOMETRY_BY_COUNT` /
`getClipGeometry()` (Nutabstand und Oberkanten-Offset je Nut-Anzahl),
`JET_OFFSETS`, `ATOMIZER_SIZES`, `CARB_BORE_SIZES`, `VHSX_BORE_GROUPS`,
`CARB_TYPES` (Mischrohre je Vergasertyp). Werte und Quellen: siehe Datei und
`KONSTANTEN_VERIFIKATION.md`.

**Korrekturhistorie (kurz):**
- 2026-08-03: 19 K-Nadeln mit fehlerhaften A/B/C/D/E-Werten aus dem
  Original-Excel gegen Eurocarb 2015 korrigiert und gegen Stein-Dinse
  gegengeprüft (K12, K13, K14, K15, K16, K18, K54, K57, K58, K61, K62, K65,
  K68, K69, K78, K79, K83, K84, K86); K97 ergänzt.
- K90 und K96 sind laut offiziellem Dellorto-Datenblatt zwei eigenständige
  Nadeln mit gleicher Geometrie, aber unterschiedlicher Clip-Anzahl. Die
  frühere Annahme, K90 existiere nicht, war falsch; die zugehörige
  K90→K96-Migration wurde entfernt. Details: `KONSTANTEN_VERIFIKATION.md`,
  Abschnitt „K90 — Richtigstellung“.

---

## Berechnung – calc.js

Einstieg ist `calcSetup(setup, needleSource)`; `needleSource` ist in der App
`getAllNeedles()` (Basis + Custom Needles), sonst `NEEDLE_DB`. Ein Setup wird
nur berechnet, wenn **alle** Eingaben gesetzt sind — sonst liefert
`calcSetup()` `null` (JavaScript würde fehlende Zahlen stillschweigend als 0
rechnen und plausible, aber falsche Kurven erzeugen).

**Formeln in Worten** (maßgeblich ist der Code):
- **Leerlaufposition (`idlePos`):** Nadellänge (`getNeedleLength()`) minus
  minimal freiliegende Nadellänge (`minExposed` nach `carbType` der Nadel)
  minus Oberkanten-Korrektur der Nut-Geometrie relativ zur
  4-Nuten-Referenz (`getClipGeometry()`, `CLIP_TOP_OFFSET_REF`) minus
  (Clip-Position − 1) × Nutabstand plus Mischrohr-Offset (`JET_OFFSETS`)
  plus halbe Abweichung der Bohrung von 34 mm.
- **Taper-Anzahl:** `getTaperCount()` — 3 bei gesetztem `F`, 2 bei `E`,
  sonst 1 (Truthy-Prüfung wie im Excel).
- **Kennlinie:** für jeden Gasstellungspunkt (0 bis 115 % in 5-%-Schritten)
  die Nadelposition `idlePos − Gasstellung × Bohrung`, daraus der
  Nadeldurchmesser (abschnittsweise: Schaft, Taper 1, Taper 2,
  zylindrische Spitze), daraus das **HD-Äquivalent** als Wurzel aus
  (Mischrohr² − (Durchmesser × 100)²).
- **Overall:** bis 30 % Gasstellung eine feste Mischung aus Leerlaufdüse und
  HD-Äquivalent (`BLEND`), ab 35 % das Minimum aus Hauptdüse und
  HD-Äquivalent.
- **maxHD:** HD-Äquivalent bei 100 % Gasstellung (nicht das Maximum der
  Kurve; Werte über 100 % sind Extrapolation).

### Bewusste Abweichungen vom Original-Excel

a) **Leerlaufposition mit Nut-Geometrie.** Nutabstand und
   Oberkanten-Offset hängen von der gemessenen Nut-Anzahl ab (3/4/5 Nuten,
   `CLIP_GEOMETRY_BY_COUNT`); 4-Nuten-Nadeln haben Korrektur 0. Werte für
   3- und 5-Nuten-Nadeln weichen deshalb vom Excel ab (das mit festem
   Nutabstand rechnet), z. B. K98 (5 Nuten) bei Clip 3. Die Referenzwerte
   stehen in `test/calc.test.mjs` (Tests zu 3- vs. 4-Nuten- und
   5-Nuten-Nadeln).
b) **`minExposed` familienspezifisch** (`MIN_EXPOSED_BY_CARB_TYPE`, aufgelöst
   über `carbType` der Nadel, nicht über den Namenspräfix und nicht über den
   globalen Vergasertyp). Werte und Messbedingungen:
   `KONSTANTEN_VERIFIKATION.md`.
c) **HD-Äquivalent nie `NaN`.** Ist der Nadeldurchmesser größer als das
   Mischrohr, klemmt `calcSetup()` den Wurzel-Radikanden auf 0
   (`Math.max(0, …)`), wo das Excel einen Fehlerwert liefern würde.

### Kein Excel-Fehler bei maxHD

**Nicht „korrigieren“.** Im Original-Excel verweisen `Chart!G5`–`G9` jeweils
korrekt auf die eigene Tabelle `'Calc Data 1'`…`'Calc Data 5'`
(`SQRT($E5^2-('Calc Data N'!$C$45*100)^2)`). Die Web-App rechnet maxHD je Setup
aus der eigenen Kurve und **entspricht damit dem Original** — das ist keine
Abweichung.

Die frühere Behauptung, G6/G7 zeigten wegen eines Copy-Paste-Fehlers auf
`'Calc Data 1'`, stammte aus einer lokal geänderten Kopie der Tabelle, die
inzwischen aus dem Repository entfernt wurde. Sie gilt für das Original nicht.
Nachgerechnet gegen die im Original gespeicherten Beispiel-Setups stimmen 4 von
5 maxHD-Werten exakt überein; die einzige Abweichung ist K27 (5 Nuten) und
geht auf Punkt a) zurück. Referenztabelle: README, Abschnitt „Verification“.

---

## Beta-Status PHBH / PHBL

- Beide Typen stehen in der UI in der Gruppe „Beta Features“ (BETA-Badge,
  Info-Tooltip, Warnbanner im Setups-Bereich); VHSx steht allein in der
  primären Gruppe.
- **Regel:** Die gekoppelten Konstanten eines Vergasertyps — Nadellänge
  (`NEEDLE_LENGTHS`) und `MIN_EXPOSED_BY_CARB_TYPE` — nie einzeln ändern,
  sondern nur gemeinsam und nur nach physischer Messung. Stand und
  Messbedingungen: `KONSTANTEN_VERIFIKATION.md`.
- **Maßgeblich sind die Werte in `js/calc.js` und `js/needledb.js`.**
  Frühere Annahmen (X-Nadellänge 68 mm, PHBH-`minExposed` 26.4 mm) sind
  überholt.

---

## Custom Needles

- **Zwei-Schichten-Modell:** `NEEDLE_DB` bleibt unverändert; eigene Nadeln
  liegen in `dellorto_custom_needles` und werden von App-Updates nie
  überschrieben. `getAllNeedles()` (`storage.js`) führt beides zusammen;
  im Konfliktfall gewinnt die Custom Needle.
- **Gespeicherte Felder:** `type` (in Großbuchstaben), `carbType`, `A`,
  `B`, `C`, optional `D`/`E`/`F`, `length`, `clips`.
- **Validierung (`validateNeedle()`):** Vergasertyp, Typ und A/B/C sind
  Pflicht; bei VHSx zusätzlich die Längen-Auswahl. Der Typ darf nicht in
  `NEEDLE_DB` existieren. `D` und `E` nur gemeinsam; `F` nur mit `D`/`E`.
  Eine bereits vorhandene Custom Needle gleichen Typs wird nur nach
  Rückfrage überschrieben.
- **Länge je Vergasertyp (`readNeedleForm()`):** VHSx über die Auswahl
  K- oder U-Typ (`VHSX_LENGTH_BY_TYPE`), PHBH/PHBL fest über
  `CARB_TYPE_NEEDLE_LENGTH` in `app.js`. Die Länge wird in der Custom Needle
  gespeichert. Achtung: `CARB_TYPE_NEEDLE_LENGTH.PHBH` entspricht derzeit
  nicht `NEEDLE_LENGTHS.X` — offener Punkt.
- **Clip-Geometrie:** Custom Needles bekommen immer die 4-Nuten-Referenz
  (Korrektur 0), weil die nach Nut-Anzahl gemessene Geometrie nur für
  `NEEDLE_DB` gilt (`getClipGeometry()`). Per-Nadel-Overrides
  (`clipSpacing`/`clipTopOffset`) wertet `getClipGeometry()` zwar aus,
  `getAllNeedles()` übernimmt sie für Custom Needles aber nicht.
- **Einreichen:** „Submit to developer“ öffnet per `buildMailtoLink()` den
  Mail-Client mit vorausgefüllter Mail an `jetting@ejais.de` (Vergasertyp,
  Typ, A–F, Platz für Quelle). Kein Server, kein API-Key.
- Custom Needles sind nicht teilbar (siehe „Share links“).

---

## Share links

Implementiert in `js/share.js` (reines ES-Modul, kein DOM/localStorage-Zugriff,
importiert nur `needledb.js` — dadurch mit `node --test` isoliert testbar,
siehe `test/share.test.mjs`) und in `js/app.js` (`openShareDialog()` /
`applyShareFromUrl()`) an die UI angebunden.

### URL-Schema (v1)

```
?v=1&c=<carbType>&s<N>=<needleType>-<clipPos>-<carbSize>-<needleJet>-<jetType>-<nd>-<hd>&n<N>=<name>
```

- `v`: Format-Version des Links, aktuell fest `1` (`SHARE_VERSION` in `share.js`).
- `c`: der globale `carbType` (`VHSx` | `PHBH` | `PHBL`).
- `s<N>` (`N` = 1–5, ein Parameter pro nicht-leerem Slot): genau sieben mit
  `-` getrennte Felder in fester Reihenfolge — `needleType-clipPos-carbSize-
  needleJet-jetType-nd-hd`. Ein leeres Feld steht als leerer String zwischen
  zwei `-`. `-` ist bewusst der Trenner, weil `carbSize` Werte wie `"39.5"`
  enthalten kann, aber nie `-`.
- `n<N>`: nur gesetzt, wenn der Setup-Name vom Default `#N` abweicht.
- Komplett leere Slots (`isSlotEmpty()`) werden beim Erzeugen des Links
  weggelassen, nicht als leerer `s<N>`-Parameter mitgeschickt.
- `shareParamKeys()` (`share.js`) ist die alleinige Quelle der Wahrheit für
  die Menge aller Parameter-Namen (`v`, `c`, `s1`–`s5`, `n1`–`n5`). `app.js`
  nutzt sie, um nach dem Anwenden eines Links **nur** diese Parameter wieder
  aus der URL zu entfernen — ein zufällig mitgeführter anderer Query-Parameter
  oder ein `#Hash` bleibt erhalten.

### Validierungsregeln (`decodeShare()`)

- `v` muss exakt `"1"` sein, sonst `{ ok:false, reason:'version' }`.
- `c` muss ein bekannter Key in `CARB_TYPES` sein, sonst
  `{ ok:false, reason:'carbType' }`.
- Pro Slot müssen genau 7 mit `-` getrennte Felder vorhanden sein — sonst
  bleibt der ganze Slot leer und es gibt eine Warnung
  `{ code:'malformedSlot', slot }`.
- Whitelist-Validierung je Feld; ein ungültiger Wert wird `null` plus einer
  Warnung `{ code:'invalidField', slot, field }`:
  - `needleType`: muss ein Key in `NEEDLE_DB` sein, dessen `carbType` zum
    importierten `c` passt.
  - `clipPos`: ganzzahlig, `1..getClipCount(needleType)`. Ist `needleType`
    bereits `null` (leer oder ungültig), wird `clipPos` automatisch mit-genullt
    — ohne eigene Warnung, da es dafür keinen Nadel-Bezug mehr gibt.
  - `carbSize`: muss in `CARB_BORE_SIZES[c]` enthalten sein.
  - `jetType`: muss in `CARB_TYPES[c].atomizers` enthalten sein.
  - `needleJet`: muss in `ATOMIZER_SIZES[jetType]` enthalten sein — hängt
    vom (bereits validierten) `jetType` desselben Slots ab.
  - `nd`: 0–200, `hd`: 0–300 (`Number.isFinite`, inklusive Grenzen).
- Name: Steuerzeichen werden entfernt, dann getrimmt und auf 30 Zeichen
  gekürzt; bleibt danach nichts übrig, gilt der Default `#N`. `decodeShare()`
  escaped den Namen NICHT als HTML — das bleibt bewusst Aufgabe der
  Render-Funktionen in `app.js` (`renderTable`, `renderCalcResults`,
  `renderCrossSection`, `buildCrossSectionSVG`), die dafür alle bereits
  `escapeHtml()` verwenden. Es gibt in `share.js` keinen `innerHTML`-Pfad.
- Ein Link mit korrektem `v`/`c`, aber ohne einen einzigen aktiven Slot (z.B.
  weil ein Messenger die `s1..s5`-Parameter beim Kopieren/Weiterleiten
  abgeschnitten hat), wird von `applyShareFromUrl()` in `app.js` wie ein
  korrupter Link behandelt und nicht angewendet — `encodeShare()` erzeugt
  einen solchen Link nie selbst (siehe `noActiveSetups` unten).

### Entscheidung: Custom Needles werden nicht unterstützt

`decodeShare()` validiert `needleType` bewusst gegen die statische, mit der
App ausgelieferte `NEEDLE_DB` — **nicht** gegen `getAllNeedles()` aus
`storage.js` (die zusätzlich lokale Custom Needles einschließen würde).
Custom Needles leben ausschließlich lokal beim Ersteller
(`dellorto_custom_needles` in `localStorage`); ein Link, der auf so eine
Nadel verweist, wäre bei jeder anderen Person kaputt, weil die referenzierte
Geometrie dort schlicht nicht existiert.

Deshalb verweigert bereits `encodeShare()` das Erzeugen eines Links, sobald
ein zu exportierender (nicht-leerer) Slot eine `needleType` hat, die nicht
in `NEEDLE_DB` steht:
```js
{ ok: false, reason: 'customNeedle', details: [{ id, name, needleType }, ...] }
```
Die Share-UI (`openShareDialog()` in `app.js`) zeigt dafür eine Fehlermeldung
mit den betroffenen Setup-Namen und Nadeltypen (`err.share.customNeedle` in
`js/i18n.js`, mit `{setups}`/`{needles}`-Platzhaltern) anstelle des Links.

### Import-/Undo-Verhalten

- `applyShareFromUrl()` (`app.js`) läuft im `DOMContentLoaded`-Handler, bevor
  irgendetwas `setups`/`carbType` liest — vor der Initialisierung der
  `carbType`-Radios und vor `updateUI()` — und tut nur etwas, wenn
  `hasShareParams(location.search)` `true` ist (Query-String enthält `v`).
- Ist der Browser beim Öffnen offline (`isShareLinkPossiblyStale()`), wird
  zusätzlich `msg.shareOfflineStaleWarning` angezeigt: der Link wird dann
  womöglich gegen eine ältere, gecachte `needledb.js` dekodiert.
- Die Share-Parameter werden über `scrubShareParamsFromUrl()` (nutzt
  `shareParamKeys()`) in jedem Fall aus der URL entfernt — bei Erfolg, bei
  Fehler und bei „keine aktiven Setups im Link" gleichermaßen — damit ein
  Reload denselben Link nie erneut anwendet.
- `ok:false` (falsche Version/`carbType`) oder ein syntaktisch gültiger,
  aber leerer Link → Notice (`msg.shareVersion` bzw. `msg.shareInvalid`),
  **nichts** wird überschrieben.
- `ok:true`: Ist `stateKey(neuer Zustand) === stateKey({carbType, setups})`
  (aktueller Zustand), ändert sich nichts — kein redundanter Import.
- Andernfalls: Nur wenn lokal bereits Daten vorhanden sind
  (`!setups.every(isSlotEmpty)`), wird der aktuelle Zustand
  (`{setups, carbType}`) per `structuredClone()` als Snapshot gesichert —
  ausschließlich im Speicher (`importUndo`), **nie** in `localStorage`. War
  lokal nichts vorhanden, gibt es keinen Snapshot und der Undo-Button bleibt
  versteckt.
- Der importierte Zustand wird übernommen und wie jede andere Änderung über
  die bestehenden `saveSetups()`/`saveCarbType()` persistiert. Das
  Import-Banner (`#import-banner`) erscheint mit Hinweistext und optionalem
  Undo-Button. Ungültige/übersprungene Felder aus dem Link werden zusätzlich
  als Anzahl über eine separate Notice gemeldet (`msg.shareFieldsIgnored`,
  Platzhalter `{n}`).
- **Undo** (`#btn-import-undo`) stellt den Snapshot wieder her, speichert ihn
  über `saveSetups()`/`saveCarbType()` und ruft `updateUI()` auf. Der Snapshot
  selbst existiert nur im Speicher; es gibt keine eigene Persistenzschicht
  dafür.
- Das Banner verschwindet auf zwei Wegen: (a) sofort bei Klick auf ✕
  (`hideImportBanner()`), oder (b) automatisch, sobald
  `stateKey({carbType, setups})` vom beim Import gemerkten `importedKey`
  abweicht. Dieser zweite Check läuft **zentral in `updateUI()`** (nicht in
  einzelnen Edit-Handlern verstreut), damit z. B. ein Sprachwechsel — der
  ebenfalls `updateUI()` aufruft, aber weder `carbType` noch `setups`
  verändert — das Banner nicht fälschlich schließt.

### Hinweis: Datenbank-Änderungen wirken auf bestehende Links

Ein Share-Link enthält ausschließlich Benutzereingaben (`needleType`,
`clipPos`, `carbSize`, `needleJet`, `jetType`, `nd`, `hd`) — keine
berechneten Werte. Deshalb wirken sich spätere Änderungen an `NEEDLE_DB`,
`CARB_BORE_SIZES` oder `ATOMIZER_SIZES` direkt auf die Gültigkeit bereits
verschickter, älterer Links aus:

- Eine im Link referenzierte `needleType`, die zwischenzeitlich aus
  `NEEDLE_DB` entfernt oder umbenannt wurde (z. B. bei einer
  Datenkorrektur), fällt beim Decode durch die Whitelist-Prüfung und wird
  stillschweigend `null` + Warnung — ebenso der davon abhängige `clipPos`.
- Ein `clipPos`, der beim Erzeugen des Links noch gültig war, aber nach
  einer Korrektur des `clips`-Werts der Nadel nicht mehr im erlaubten
  Bereich liegt, wird ebenfalls genullt.
- Eine `carbSize` oder ein `needleJet`, die aus der jeweiligen Whitelist
  entfernt werden, verschwinden beim Decode auf dieselbe Weise.

Es gibt **keine Versionierung pro Datenbank-Stand** — `SHARE_VERSION`
(aktuell `1`) beschreibt nur das URL-/Feld-Format, nicht den Inhalt von
`NEEDLE_DB`/`CARB_BORE_SIZES`/`ATOMIZER_SIZES`. Ein alter Link bleibt also
nur so lange vollständig nutzbar, wie alle darin referenzierten Werte auch
in der aktuell ausgelieferten Datenbank noch existieren; andernfalls verliert
der Empfänger beim Öffnen kommentarlos nur die betroffenen Felder (mit
`msg.shareFieldsIgnored`-Hinweis), nicht den ganzen Link.

---

## Nadelkatalog (Needle catalog)

### Zweck

Zweiter Tab neben dem Rechner ("Nadelkatalog" / "Needle catalog"): eine
Geometrie-Übersicht aller Nadeln eines Vergasertyps (Basis-Datenbank plus
lokale Custom Needles) mit Filterleiste, Suche, sortierbarer Tabelle und
einer ein-/ausblendbaren Maßlegende (dasselbe Nadel-Schema wie im
Custom-Needles-Abschnitt).

Der Tab ist bewusst der **einzige** Einstiegspunkt. Es gibt keine Absprünge
aus Setup-Zeilen oder aus dem Custom-Needles-Abschnitt in den Katalog —
Entscheidung zur Vermeidung redundanter Einstiege.

### Modulaufteilung

- `js/needlecatalog.js` — reine Logik, analog zu `share.js`: importiert nur
  `needledb.js`, kein DOM, kein localStorage, kein i18n, keine sichtbaren
  Texte (nur Keys, Zahlen, Codes). Liefert `CATALOG_COLUMNS`,
  `buildCatalogRows()`, `filterCatalogRows()`, `sortCatalogRows()`,
  `countByTaper()`, `getSeriesList()`, `compareNeedleTypes()`,
  `formatCatalogValue()`. Getestet in `test/needlecatalog.test.mjs`.
  Die gemeinsamen Helfer `getNeedleLength()`, `getTaperCount()` und
  `VERIFIED_DEFAULT_CLIP_PREFIXES` liegen in `needledb.js` und werden auch
  von `calcSetup()` genutzt (Single Source of Truth).
- `js/app.js` — UI: `showView()` (Tab-Wechsel), `renderNeedleCatalog()`
  (ruft `renderCatalogLegend()`, `renderCatalogControls()`,
  `renderCatalogTable()`), `mountNeedleSchematic()` (klont
  `<template id="tpl-needle-schematic">` in jeden `[data-schematic]`-Wrapper,
  hängt an jede id `-<suffix>` an und schreibt `url(#…)`-Verweise um, damit
  zwei Kopien nie gegenseitig ihre Pfeil-Marker referenzieren).
  Die Suche (`#catalog-search`) liegt außerhalb des neu gerenderten
  Bereichs und rendert nur die Tabelle neu — der Fokus bleibt beim Tippen
  erhalten.

### Zustand: `catalogState`

- Nur im Speicher, nie in localStorage: `carbType`, `series`, `tapers`,
  `query`, `usedOnly`, `sortKey`, `sortDir`, `legendOpen`.
- `carbType: null` bedeutet "folgt dem Rechner" (`catalogState.carbType ??
  carbType`). Ein Vergasertyp-Wechsel im Rechner (`handleCarbTypeChange()`)
  setzt `catalogState.carbType` auf `null` und `series` auf `'all'`.
- Der Katalog schreibt **nie** `dellorto_carb_type` und fasst keine Setups
  an. Begründung: `handleCarbTypeChange()` setzt Setups, deren Nadel,
  Düsentyp oder Vergaser-Ø nicht zum neuen Typ passen, zurück — ein
  Durchblättern der PHBL-Nadeln im Katalog darf die VHSx-Setups des
  Rechners nicht löschen.
- Neu gerendert wird der sichtbare Katalog zentral in `updateUI()`
  (Setup-Änderungen, Custom Needle speichern/löschen, Sprachwechsel) sowie
  beim Dark-Mode-Wechsel (die Setup-Farbpunkte hängen an `getColors()`).

### Routing

- `#needles` = Katalog, ohne Hash = Rechner. `showView()` setzt per
  `history.pushState()` nur den Hash (pathname + search bleiben erhalten);
  `popstate`/`hashchange` synchronisieren die Ansicht zurück.
- Die Startansicht wird im `DOMContentLoaded`-Handler nach
  `applyShareFromUrl()` aus `location.hash` bestimmt. Verträglich mit den
  Share-Links: `scrubShareParamsFromUrl()` entfernt nur die Share-Parameter
  und lässt den Hash stehen; ein Share-Link mit `#needles` importiert also
  die Setups und öffnet danach den Katalog.

### Formatierung

- `formatCatalogValue()`: Dezimalpunkt in beiden Sprachen (konsistent zu
  `toFixed()` im restlichen `app.js`), keine Locale-Formatierung.
- Keine aufgefüllten Nachkommastellen über das Nötige hinaus: Durchmesser
  2–3, Positionen/Längen 1–2 Nachkommastellen — Werte werden nur so genau
  gezeigt, wie die Quelle sie hergibt. `test/needlecatalog.test.mjs` prüft
  per Round-Trip (`parseFloat(format(v)) === v`) für alle Werte aus
  `NEEDLE_DB`, dass nichts gerundet wird.
- Fehlende Werte: `CATALOG_EMPTY_VALUE` (`–`).

### Clip-Anzahl

`clipsSource` je Zeile: `'verified'` (per-Nadel-Wert aus `NEEDLE_DB` oder
Serie in `VERIFIED_DEFAULT_CLIP_PREFIXES`, derzeit nur D), `'custom'`
(Custom Needle) oder `'default'` (unverifizierter Serien-Platzhalter, X und
U). `'default'` wird in der Tabelle mit "*" gekennzeichnet
(`.catalog-unverified`, Tooltip `catalog.clipsDefault.tooltip`, Erklärung in
der Fußnote).

### i18n

- Alle Texte über `t()` / `data-i18n*` (`view.*`, `catalog.*`).
- Die Spaltenüberschriften nutzen dynamische Keys
  (`` t(`catalog.col.${key}`) ``), die die statische `t('…')`-Prüfung nicht
  sieht; `test/i18n.test.mjs` prüft sie deshalb explizit gegen
  `CATALOG_COLUMNS` in `en` und `de`.
- Im Deutschen gilt einheitlich "Taper" (nicht "Konus") — in `catalog.*`,
  `ref.*` und `svg.*`.

### Service Worker

`./js/needlecatalog.js` steht in `PRECACHE_URLS` (`sw.js`) und in der
gespiegelten Liste in `test/sw.test.mjs`.

---

## PWA / Service Worker

- `sw.js` precacht alle Dateien aus `PRECACHE_URLS`; `test/sw.test.mjs`
  spiegelt die Liste und prüft zusätzlich, dass jedes in `manifest.json`
  und `index.html` referenzierte Icon enthalten ist.
- Navigationen werden cache-first bedient; Navigationen mit
  Share-Parametern (`isShareNavigation()`, nutzt `hasShareParams()` aus
  `share.js`) network-first mit Timeout, damit ein Link gegen die aktuelle
  Nadeldatenbank dekodiert wird.
- Ein neuer Service Worker aktiviert sich nicht selbst, sondern wartet, bis
  der Nutzer im Update-Banner „Update now“ wählt (`SKIP_WAITING`-Nachricht).
- **`JETTINGCALC_CACHE_VERSION` ist generiert** (Hash über Pfad und Inhalt
  aller precachten Dateien) und wird nie von Hand editiert. Neu erzeugen
  mit `npm run sync-sw-version`, automatisch über den pre-commit-Hook
  (unten). Die eigentliche Absicherung ist `test/sw.test.mjs`: er schlägt
  fehl, sobald der Wert nicht zum Inhalt der precachten Dateien passt.
- **Bekannter offener Punkt:** Es gibt keinen Navigations-Fallback für nicht
  gecachte URLs. Precacht ist `./`, eine Offline-Navigation auf z. B.
  `/index.html` findet daher keinen Cache-Eintrag und schlägt fehl. Das ist
  der rote Test „offline: fresh load, then offline reload …“ in
  `test-browser/pwa.mjs`.

### Git Hooks (optional, empfohlen)

`.githooks/pre-commit` führt `npm run sync-sw-version` aus und stagt `sw.js`
neu, falls sich der Wert geändert hat. Git-Hooks werden nicht mitgeklont;
einmalig pro Checkout aktivieren mit `git config core.hooksPath .githooks`.
Der Hook rechnet über den Arbeitsbaum, nicht über den Index — bei teilweise
gestagten Änderungen daher vorher `git stash --keep-index`, sonst passt der
Hash nicht zum Commit. Der Hook ist nur Bequemlichkeit; er lässt sich mit
`--no-verify` umgehen, `test/sw.test.mjs` nicht.

---

## Tests

- **Unit-Tests:** `node --test` (bzw. `npm test`) führt alle
  `test/*.test.mjs` aus — Node-Testrunner, keine Abhängigkeiten. Abgedeckt
  sind unter anderem Berechnung (`calc`), Share-Links (`share`), Service
  Worker (`sw`), Nadelkatalog (`needlecatalog`) und die
  EN/DE-Vollständigkeit (`i18n`).
- **Browsertests:** `node --test test-browser/*.mjs` (Playwright,
  Chromium; `npm install` nötig). Mit der Umgebungsvariable
  `CHROMIUM_PATH` lässt sich ein vorinstalliertes Chromium verwenden.
  Details und manuelle Checkliste: `TESTING.md`.
- **Konvention:** vor jedem Merge ist `node --test` grün; die Browsertests
  laufen ebenfalls grün, abgesehen von bekannten, dokumentierten Fehlern
  (derzeit der Offline-Test in `pwa.mjs`, siehe oben).

---

## Copyright & Attribution

- **Ursprung:** Die Berechnungslogik basiert auf dem Excel-Tool
  *"Calculate Jetting for Dellorto Carbs v1.5"*. Der Copyright-Hinweis in
  der Tabelle lautet wörtlich: „Copyright (C) 2014 GUE, Licensed under GNU
  General Public License (GPL) Version 2.0“. Genau so („GUE“) wird der
  Rechteinhaber überall im Projekt genannt, auch in den Datei-Kopfzeilen
  (`Copyright (C) 2014 GUE — GPL v2.0`); eine Auflösung der Abkürzung ist
  nicht belegt und wird nicht verwendet.
- Nicht zu verwechseln mit dem kommerziellen Dellorto-Rechner von
  dragonfly75.com.
- **Versionshistorie des Originals** (aus den Excel-Kommentaren): siehe
  README, Abschnitt „Version history of original spreadsheet“.
- **Lizenz der WebApp:** GPL-2.0 (Copyleft), Quellcode öffentlich unter
  github.com/EJAIS/jettingcalc.
- **`/original/`:** enthält zu Referenz- und Attributionszwecken
  ausschließlich das **unveränderte** Original `Dellorto_Jetting_Gue.xlsx`
  (Download-Stand 2022, byte-identisch committet, SHA-256
  `4138cb52c7d108c9308d4c50ff540bf419f3d8d4cc387862600e00cafb6e1807`, ohne
  `docProps/`-Verzeichnis und ohne `MSIP_`-Klassifizierungsmetadaten).
  **Nie öffnen und neu speichern** — auch nicht mit openpyxl oder
  LibreOffice —, nur lesend auswerten (z. B. über `zipfile`), und aus
  demselben Grund keine lokal geöffneten oder neu gespeicherten Kopien
  hinzufügen: jedes Neuschreiben ändert die Bytes und damit den Hash, und
  Office-Programme schreiben dabei Autor- und Organisations-Metadaten in die
  Datei.

### Pflicht-Footer

Jede Seite enthält den Footer genau so, wie er derzeit in `index.html`
steht:

```html
<footer>
  Based on "Calculate Jetting for Dellorto Carbs v1.5"<br>
  Found a bug? <a href="mailto:jetting@ejais.de?subject=Bug report for Dellorto Jetting Calculator">Report it</a><br>
  Copyright (C) 2014 GUE - Licensed under <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL v2.0</a>
  <p data-i18n="footer.disclaimer">This tool is provided for informational purposes only. Calculations may contain errors — always verify jetting settings with a qualified mechanic. The author accepts no liability for engine damage, personal injury, or any other loss arising from the use of this software.</p>
  <span data-i18n="footer.webport">Web port:</span> <a href="https://github.com/EJAIS/jettingcalc">github.com/EJAIS/jettingcalc</a><br>
  <span id="footer-gsf-note"></span><br>
  <a href="https://www.germanscooterforum.de/" target="_blank" rel="noopener noreferrer">
    <img src="https://cdn.germanscooterforum.de/monthly_06_2009/post-3663-1245607528.jpg"
         alt="German Scooter Forum" class="footer-gsf-logo">
  </a>
</footer>
```
