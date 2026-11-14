# Konstanten-Verifikation

Tracking-Dokument für die Verifikation von Nadel- und Berechnungskonstanten in
`js/needledb.js` und `js/calc.js` gegen externe Referenzquellen (jenseits des
ursprünglichen 2014er GUE-Excel).

> Hinweis: Diese Datei existierte zuvor nicht im Repository und wurde am
> 2026-08-03 neu angelegt.

---

## Bereits verifiziert

### K-Nadeln (VHSx) — Eurocarb 2015 / Stein-Dinse

- **Datum:** 2026-08-03
- **Quelle:** Eurocarb, offizielle Spezifikation (2015 Update); gegengeprüft
  gegen das Stein-Dinse Dellorto-Handbuch
- **Befund:** Der ursprüngliche 2014er GUE-Excel hatte offenbar
  Übernahmefehler aus einer minderwertigen Vorquelle geerbt. 19 K-Nadeln
  hatten fehlerhafte A/B/C/D/E-Werte.
- **Korrigierte Nadeln:** K12, K13, K14, K15, K16, K18, K54, K57, K58, K61,
  K62, K65, K68, K69, K78, K79, K83, K84, K86 (Detail-Diff siehe Git-Historie
  von `js/needledb.js`).
- **Nummerierungsfehler (überholt):** siehe Abschnitt "K90 —
  Richtigstellung" weiter unten — die hier ursprünglich getroffene
  Annahme (K90 existiere nicht) wurde später anhand einer besseren
  Quelle korrigiert.
- **Ergänzung:** K97 (A:2.50, B:1.80, C:44.5) war zuvor nicht in der
  Datenbank enthalten und wurde ergänzt.

### K90 — Richtigstellung (2026-08-xx)

- Frühere Annahme (2026-08-03): K90 existiert nicht, Werte gehören
  zu K96 — basierend auf einer damals unvollständigen Eurocarb-Quelle.
- Neue Quelle: offizielles Dellorto-Datenblatt "Dimensions Aiguilles K"
  (dellorto.fr, PDF-Anhang der Produktseite), listet K90 als
  eigenständige, aktuell verkaufte Nadel (Ref. 08530_90) mit A:2.50,
  B:1.75, C:42, 4 Clip-Positionen — abweichend von K96 (5 Positionen).
- Status: K90 wieder als eigenständige Nadel geführt, Migration
  rückgängig gemacht (siehe storage.js).

K26, K55, K64 bleiben weiterhin unbelegt — auch im offiziellen PDF
ohne Werte gelistet (echte Lücke in Dellortos eigener Nummerierung,
kein Datenfehler).

### D-Type-Nadeln (PHBL) — Eurocarb / Stein-Dinse

- Siehe Quellenangabe direkt im Code-Kommentar oberhalb der D-Nadeln in
  `js/needledb.js` ("Source: Eurocarb, cross-verified against Stein-Dinse
  handbook").

### Clip-Nut-Geometrie (`CLIP_GEOMETRY_BY_COUNT`)

- **Datum:** 2026-08 (D-Nadel, 4 Nuten) / 2026-09 (K-Nadeln, 3/4/5 Nuten)
- **Methode:** Spannmaß Außenkante oberer Clip → Außenkante unterer
  Clip abzüglich Nutbreite 0,50 mm, geteilt durch Anzahl der Lücken;
  zusätzlich Abstand Nadel-Oberkante → Oberkante Nut 1.
- **Befund (K-Nadeln):**
  | Nuten | Spannmaß | Abstand | Oberkante → Nut 1 |
  |-------|----------|---------|--------------------|
  | 3     | 2,90     | 1,20    | 3,10               |
  | 4     | 4,10     | 1,20    | 1,60               |
  | 5     | 4,50     | **1,00**| 1,50               |

  Die 4-Nut-Messung (4,10 − 0,50 = 3,60 mm über 3 Lücken) reproduziert
  die frühere D-Nadel-Messung exakt.
- **Konsequenzen:** `CLIP_SPACING` ist keine globale Konstante mehr —
  5-Nut-K-Nadeln (33 Stück) rechnen mit 1,0 mm. Zusätzlich wird der
  Oberkante-Offset relativ zur 4-Nut-Geometrie korrigiert: 3-Nut-K-
  Nadeln (15 Stück) hängen 1,5 mm höher, 5-Nut 0,1 mm tiefer.
- **Annahme (nicht verifizierbar ohne VHSx-Vergaser):** `minExposed.VHSx
  = 26,4` gilt als mit einer 4-Nut-Nadel kalibriert. PHBL (D36) und
  PHBH (X2) wurden nachweislich mit 4-Nut-Nadeln gemessen, dort ist
  die Korrektur per Konstruktion 0.
- **Regressionsschutz:** siehe `test/calc.test.mjs` (`node --test`) — prüft
  die K1/K18-Differenz (1,50 mm), die K98-Clip5-minus-Clip1-Differenz
  (−4,0 mm statt vormals −4,8 mm) sowie Unveränderheit der bereits
  verifizierten D36-/X2-idlePos-Werte (31,7 mm / 31,2 mm).

### U-Nadeln und K57/K80 — Eurocarb 2015 / Drittanbieter-Chart / offizielles Dellorto-PDF (2026-09)

- U-Nadel-Geometrie (A/B/C/D/E) 2026-09 gegen Eurocarb 2015 und ein
  Drittanbieter-Chart abgeglichen. D/E-Zuordnung der App bestätigt (der
  Drittanbieter-Chart hat dort eine Zeilenverschiebung). Zwei C-Werte
  korrigiert: U17 35→36, U19 32,5→32,6 (beide Quellen einig).
- K57 D 2,232→2,22 nach offiziellem Dellorto-PDF; K80: PDF nennt G=11
  ohne ØD/F, im Modell nicht darstellbar, als Datenblatt-Inkonsistenz
  dokumentiert.

### U- und X-Nadeln: Nut-Geometrie und Nut-Anzahl (2026-11-12)

- **Datum:** 2026-11-12
- **Methode:** Direktmessung mit Messschieber (Alexander), gleiche Methode
  wie bei den K-Nadeln (Spannmaß Außenkante oberste → unterste Nut,
  Nutbreite, Oberkante → Nut 1).
- **U16:** Gesamtlänge 68,0 mm (Zuordnung U statt K damit gesichert),
  4 Nuten, Spannmaß 4,10 mm, Nutbreite 0,50 mm, Oberkante → Nut 1
  1,60 mm. Nutabstand (4,10 − 0,50) / 3 = 1,20 mm — identisch mit der
  4-Nut-K-Geometrie. Keine Override-Felder `clipSpacing` /
  `clipTopOffset` für U-Nadeln nötig; `minExposed.VHSx` gilt für K und U
  ohne Versatz.
- **X13:** Gesamtlänge 55,0 mm (bestätigt `NEEDLE_LENGTHS["X"]` an einer
  zweiten X-Nadel nach X2), 4 Nuten, Spannmaß 4,10 mm, Nutbreite 0,50 mm.
  Nutabstand 1,20 mm — bestätigt `spacing = 1,2` für PHBH. X13 statt X2
  gemessen; die Messanleitung lässt jede X-Nadel zu.
- **Folge:** Mit X2 (2026-08) und X13 sowie U16 ist die Nut-Anzahl 4 für
  beide Serien gezählt. `VERIFIED_DEFAULT_CLIP_PREFIXES` in
  `js/needledb.js` enthält jetzt D, X und U; das „*“ für unverifizierte
  Clip-Anzahlen erscheint im Katalog und in der Feinabstimmung bei keiner
  Nadel aus `NEEDLE_DB` mehr.
- **Einschränkung:** je Serie eine bzw. zwei Nadeln gemessen; dass alle
  U- und X-Nadeln 4 Nuten haben, ist eine Serienannahme wie bei D.

### VHSH 30: Nadelüberstand, K57 und `minExposed.VHSx` (2026-11-14)

- **Datum:** 2026-11-14
- **Vergaser:** VHSH 30 (Bohrung nachgemessen: 30,0 mm), Mischrohre
  DQ266 und DQ267 (gleich lang), kein DP vorhanden.
- **Methode:** Nadel mit Clip in Nut 1 im Schieber, Tiefenmaß
  Schieberunterkante → Nadelspitze (Überstand Ü), Messschieber
  (Alexander).

  | Nadel | Nuten | Ü gemessen | Δ zu K24 gemessen | Δ zu K24 Modell |
  |-------|-------|------------|-------------------|-----------------|
  | K24   | 4     | 47,8 mm    | —                 | —               |
  | K98   | 5     | 48,2 mm    | +0,4 mm           | +0,1 mm         |
  | U16   | 4     | 42,3 mm    | −5,5 mm           | −5,5 mm         |

  Ü1 und Ü2 wurden auf Nachfrage wiederholt, beide unverändert.
- **K-/U-Versatz bestätigt:** U16 − K24 = −5,5 mm entspricht exakt der
  Längendifferenz (68,0 vs. 73,5 mm). `minExposed.VHSx` gilt damit für
  K- und U-Nadeln gleichermaßen, wie im Modell angenommen.
- **K57:** 5 Nuten, Gesamtlänge 73,5 mm — bestätigt `clips: 5` und
  `NEEDLE_LENGTHS["K"]`.
- **DQ266 / DQ267:** gleich lang; die Mischrohr-Größe ändert nur die
  Innenbohrung, nicht den Offset.
- **`minExposed.VHSx` (26,4 mm) — Absolutwert nicht messbar:** Die Tiefe
  der Mischrohr-Oberkante gegenüber der Schieber-Auflage (T) ließ sich
  nicht messen; das Mischrohr ragt im VHSH sichtbar in die Bohrung
  (Foto im Projekt-Thread). Aus K24 folgt minExposed = 25,7 mm + T; das
  Modell entspricht T ≈ 0,7 mm. **Entscheidung 2026-11-14 (Alexander):**
  Wert bleibt 26,4 mm und gilt als bestätigt, gestützt auf die
  bestätigten Relativmaße (K/U-Versatz, Nadellängen, Nut-Geometrie).
  Ein unabhängiger Absolutwert liegt weiterhin nicht vor. Der DP/DQ-Offset (2 mm)
  wurde mangels DP-Mischrohr nicht geprüft.
- **K98 (5 Nuten) hängt 0,3 mm tiefer als modelliert — Einzelabweichung:**
  Das Modell rechnet für 5-Nut-Nadeln mit 1,50 mm Oberkante → Nut 1
  (4 Nuten: 1,60 mm), also +0,1 mm gegenüber K24. Gemessen am Überstand
  +0,4 mm. Direktmessung Oberkante → Nut 1 (gleicher Messschieber, gleiche
  Methode): K24 1,5 mm, K98 1,1 mm, K57 (5 Nuten) 1,5 mm. Die
  K98-Abweichung ist damit in sich konsistent (beide Messwege 0,4 mm),
  K57 zeigt sie aber nicht; die Differenz 5-Nut ↔ 4-Nut von ≈ 0,1 mm aus
  der Messung 2026-09 bleibt plausibel. **Folge (2026-11-14):** Alexander
  hatte die Korrektur an eine Bestätigung durch K57 geknüpft; die blieb
  aus. Deshalb keine Änderung an `CLIP_GEOMETRY_BY_COUNT` und kein
  Per-Nadel-Override für K98 — eine einzelne Nadel kann Fertigungs- oder
  Exemplarstreuung sein. Eine zweite K98 würde klären, ob es typbedingt
  ist.

### `NEEDLE_LENGTHS["D"]` = 52.0 mm

- **Datum:** 2026-08
- **Methode:** Direktmessung der Gesamtlänge einer D-Nadel.
- **Befund:** bestätigt.

### `NEEDLE_LENGTHS["K"]` = 73.5 mm und `NEEDLE_LENGTHS["U"]` = 68.0 mm

- **Datum:** 2026-08
- **Methode:** Direktmessung der Gesamtlänge (Messschieber) an K98,
  K24 und U16.
- **Befund:** beide bisherigen, unverändert aus der 2014er GUE-Excel
  übernommenen Werte bestätigt — K: 73,5mm (K98, K24), U: 68,0mm (U16).
- **Anmerkung:** bei der ersten Messrunde wurden K24 und U16 versehentlich
  vertauscht zugeordnet (K24 zunächst mit 68mm, U16 mit 73,5mm gemeldet —
  exakt die Werte der jeweils anderen Familie). Das Muster fiel auf, weil
  beide Abweichungen exakt auf den Wert der anderen Präfix-Konstante
  fielen statt zufällig zu streuen; nach Prüfung bestätigte sich eine
  Verwechslung der beiden physisch ähnlichen Nadeln. Nach Korrektur
  stimmen beide Werte mit der Excel-Annahme überein. Für spätere
  Messungen: K- und U-Nadeln sind ohne dauerhafte Beschriftung leicht zu
  verwechseln — Zuordnung vor dem Messen doppelt prüfen.
- Damit sind jetzt alle vier Nadellängen-Konstanten (D, X, K, U)
  unabhängig verifiziert.

### `minExposed` (`MIN_EXPOSED_BY_CARB_TYPE` in `js/calc.js`)

- **PHBL:** 16.3 mm — gemessen 2026-08 an einem 26 mm PHBL mit D36-Nadel
  und AQ-Mischrohr (idlePos 31.70 mm bei Clip 1), gegen eine unabhängige
  Messkette gegengeprüft. Siehe Verifikationswert in `js/calc.js`.
- **PHBH:** 23.8 mm — gemessen 2026-08 an einem 30 mm PHBH mit X2-Nadel
  und AS266-Mischrohr (idlePos 31.2 mm bei Clip 1); Details im Abschnitt
  „X-Nadel-Länge und `minExposed` (PHBH) — Auflösung“.

### X-Nadel-Länge und `minExposed` (PHBH) — Auflösung

- **Datum:** 2026-08
- **Methode:** Direktmessung der Gesamtlänge einer X2-Nadel (55,0mm,
  Messschieber) plus idlePos-Messung an einem 30mm PHBH mit X2-Nadel,
  AS266-Mischrohr, Clip 1 (idlePos 31,2mm, indirekt über
  Schieber-Überstand und Vergaser-Innenmaße ermittelt, da eine
  direkte Messung durch die Mischrohröffnung bei eingesetztem
  Schieber mechanisch nicht möglich ist).
- **Befund:** `NEEDLE_LENGTHS["X"]` korrigiert von 68,0mm (fehlerhafte
  Analogie zu U-Nadeln) auf **55,0mm** — deckt sich mit der zuvor nur
  als Snippet-Evidenz vorliegenden Eurocarb-Angabe für Teilenr. 9477
  sowie einem offiziellen Dellorto-Datenblatt (dellorto.fr, X01:
  "Length: 55mm"). Erklärt zugleich die X37-Fußnote "56,2mm" als
  55mm Basis + 1,2mm Clip-Spacing.
- `MIN_EXPOSED_BY_CARB_TYPE.PHBH` korrigiert von 26,4mm (von VHSx
  geerbt) auf **23,8mm**.
- **Plausibilitätsprüfung:** alle 2088 geprüften X-Nadel-Kombinationen
  (87 Nadeln × AV/AS × 3 PHBH-Bohrungen × 4 Clip-Positionen) gegen
  negative Nadelposition bei Volllast durchgerechnet. Mit den neuen
  Werten löst sich die Nadel im Median bei ~98,5% Gasstellung aus der
  Düse (physikalisch plausibel — Hauptdüse übernimmt erst nahe
  Vollgas), keine Kombination unterschreitet 85% Gasstellung. Zum
  Vergleich: mit den alten Werten blieb die Nadel rechnerisch bis
  über 100% hinaus wirksam (Median 134,7%), was eher untypisch ist.
- **Clip-Anzahl X-Nadel:** an der X2-Nadel wurden 4 Kerben gezählt —
  bestätigt die bisherige Fallback-Annahme (`DEFAULT_CLIPS_BY_PREFIX.X
  = 4`) für mindestens diese eine Nadel.
- Basis: eine Messung, methodisch identisch zur PHBL-Messung (eine
  Nadel/Mischrohr/Bohrungs-Kombination bei Clip 1).
- **Nachtrag (2026-09):** Der Pfad für eigene Nadeln hatte die Korrektur
  auf 55,0mm bis zu diesem Fix nicht übernommen — `app.js` speicherte
  eigene PHBH-Nadeln mit einer eigenen Konstante (68,0mm), während
  `minExposed` bereits 23,8mm war; die Leerlaufposition lag dadurch um
  13mm zu hoch. Die Länge eigener Nadeln kommt jetzt aus
  `getCustomNeedleLength()` (`NEEDLE_LENGTHS`), und gespeicherte eigene
  PHBH-/PHBL-Nadeln mit abweichender oder fehlender Länge werden beim
  Start einmalig migriert (`migrateCustomNeedles()`).

---

## Noch zu verifizieren

- Berechnungskonstanten in `js/calc.js` (Blend-Tabelle) — bislang nur gegen
  die Original-Excel-Formeln verifiziert, nicht gegen eine unabhängige
  Zweitquelle.
- Vergasergrößen-Term `(carbSize − 34)/2` — Koeffizient ½ von VHSx
  geerbt, weder für PHBL noch für PHBH bei mehreren Bohrungsgrößen
  bestätigt (PHBL nur bei 26mm gemessen, PHBH nur bei 30mm). Zur
  Klärung wäre jeweils eine zweite idlePos-Messung bei einer anderen
  Bohrungsgröße nötig (PHBL z.B. 20/22mm, PHBH z.B. 26/28mm).
  **Recherche 2026-11-01:** keine externe Quelle für den Term gefunden. Er
  ist eine eigene Heuristik des Excel-Autors — Versionshistorie in der
  Original-Excel (`xl/comments1.xml`): „Version 1.4: … added basic carb
  size compensation“. Damit bleibt nur die Messung.
- ~~minExposed für VHSx~~ — erledigt 2026-11-14 per Entscheidung
  (Absolutwert nicht messbar, Relativmaße bestätigt), siehe Abschnitt
  „VHSH 30: Nadelüberstand, K57 und `minExposed.VHSx`“.
- Optional: zweite K98 messen (Oberkante → Nut 1), um die
  Einzelabweichung von 0,3 mm einzuordnen — siehe derselbe Abschnitt.
- **`CLIP_GEOMETRY_BY_COUNT` bei Custom Needles — gelöst (2026-09):**
  `getClipGeometry()` wendet die K-Nadel-Korrektur nur noch auf Nadeln
  aus `NEEDLE_DB` an. Custom Needles verwenden unabhängig von ihrer
  `clips`-Zahl immer die 4-Nut-Referenzgeometrie (Option a aus dem
  Code-Review — Option b, `clipSpacing`/`clipTopOffset` im Formular
  exponieren, bewusst nicht umgesetzt, da eine Nutzer-eingegebene
  Nut-Geometrie ohne Referenzmessung ohnehin nicht verifizierbar wäre).

### K76 ØD — Abweichung vom Original-Excel (belegt 2026-11-01)

- **Datum:** 2026-09-23
- **Status:** **belegt (Eurocarb 2015)** — Recherche 2026-11-01, siehe
  unten. `NEEDLE_DB` bleibt unverändert.
- **Befund:** Beim Abgleich des Blatts "Needle Data" des Original-Excel
  (`original/Dellorto_Jetting_Gue.xlsx`, Zeile 69) gegen `NEEDLE_DB` ist K76
  die **einzige** Nadel mit abweichender Geometrie:

  | Feld | Original-Excel | `NEEDLE_DB` |
  |---|---|---|
  | ØA | 2.46 | 2.46 |
  | ØB | 1.55 | 1.55 |
  | C | 39.0 | 39 |
  | **ØD** | **2.5** | **2.1** |
  | E | 25.0 | 25 |
  | F | 11.0 | 11 |

- **Bewertung:** Der Original-Wert ØD = 2.5 ist physikalisch unplausibel,
  weil ØD (Durchmesser am Übergang Taper 1/2) größer wäre als der
  Schaftdurchmesser ØA = 2.46. Eine Nadel verjüngt sich zur Spitze hin; ØD
  muss also ≤ ØA sein. Der Fehler liegt daher im Original.
- **Quelle für 2.1 (Recherche 2026-11-01):** Die Eurocarb-Tabelle „SPILLI
  CONICI SERIE 8530 X 08 K“ (K/U Needle charts, 2015,
  https://www.dellorto.co.uk/wp-content/uploads/2015/05/K-U-Needle-charts.pdf)
  führt K76 mit ØA 2.46, ØB 1.55, C 39, **ØD 2.10**, E 25, F 11 — exakt wie
  `NEEDLE_DB`. Die Nachbarnadel K77 hat dort ØD 2.07. Dieselben Werte stehen
  in der aus Eurocarb übernommenen Tabelle von Gregory Bender
  (thisoldtractor.com, K-Slides, aktualisiert 2015-07-10).
- **Einschränkung:** Beide Quellen gehen auf Eurocarb zurück, sind also
  keine unabhängigen Zweitquellen. Das offizielle Dellorto-Datenblatt
  „Dimensions Aiguilles K“ (dellorto.fr) war bei der Recherche nicht
  auffindbar; ein Abgleich dagegen steht noch aus.
- **Nebenbefund K75 (offen):** Beide Tabellen springen von K72 auf K76,
  K75 fehlt. `NEEDLE_DB` führt K75 (A 2.50, B 0.60, C 38, D 2.00, E 18);
  die Herkunft dieses Eintrags ist nicht belegt und sollte gegen das
  dellorto.fr-PDF geprüft werden.

## Priorität MITTEL

### Schiebertyp der VHS-Familie (Flach- vs. Rundschieber)
- Eurocarb beschreibt die VHSA/VHSB/VHSC-Familie als "Flat slide smooth
  oval bore design"; der Dellorto-Produkteintrag für den VHSH nennt
  "Flat throttle valve".
- Die Cutaway-Berechnung ist ausdrücklich auf Rundschieber-Vergaser
  kalibriert, `ROUND_SLIDE_2STROKE` enthält aktuell aber auch VHSx.
- Gegenargument: Die Cutaway-Empfehlung wurde an einem realen Setup
  verifiziert (Schieber 40 bestätigt), was gegen eine grobe
  Fehlanwendung spricht.
- **Recherche 2026-11-01 — Schiebertyp belegt:** Die VHS-Familie hat einen
  **Flachschieber**. Bei Dellorto hat die ganze VH-Reihe flache, die
  PH-Reihe (PHBH, PHBL) runde Schieber:
  - Dell'Orto-Leitfaden (Laverdamania): „On the PH series (Piston
    Horizontal) it is cylindrical; on the VH series (Valve) it is flat.“
    https://uk.laverdamania.net/technical/f/guide-dell-orto-french/
  - Green Flag Karting, Dellorto Tuner Guide (VHSB/VHSH): „plane or
    guillotine flat slide“, Schieber mit verschiedenen Ausschnitthöhen,
    wirksam bis ¼ Gas.
    https://forums.kartpulse.com/uploads/short-url/xB4GYNsQGzHtFkwzVIStJTVTKb5.pdf
  - TKART, Test VHSH 30: „The VHSH 30 has a flat valve“ (Vorgänger PHBE 30
    mit Rundschieber).
    https://tkart.it/en/magazine/under-review/dellorto-30-carburettor-kart-125-vhsh-with-flat-valve-float-bowl
- Folge: Die frühere Einordnung von VHSx in `ROUND_SLIDE_2STROKE`
  (`js/cutaway.js`) war sachlich falsch. Auch Flachschieber tragen aber nummerierte
  Ausschnitte (z. B. 40 = 4.0 mm) mit derselben Wirkung bis ¼ Gas, und die
  Empfehlung ist praktisch bestätigt (Schieber 40). Ob die
  Forrest-Heuristik für Flachschieber gleich gut passt, ist nicht belegt.
- **Sichtprüfung 2026-11-01 (Alexander):** VHSx-Vergaser haben einen
  Flachschieber — die Recherche ist damit am realen Teil bestätigt.
- **Entscheidung 2026-11-01 (Alexander):** Cutaway-Empfehlung für VHSx
  bleibt. Die Liste heißt jetzt `SLIDE_CUTAWAY_2STROKE`
  (`hasSlideCutaway2Stroke()`), README und Hinweistext
  (`cutaway.disclaimer`) nennen VHSx als Flachschieber, für den die
  Heuristik nicht gesondert geprüft ist.
- Status: erledigt.

### Gasstellungsbereich über 100 % (105/110/115 %)
- Bei tp = 1,0 ist der Schieber um genau eine Bohrungsweite angehoben, die
  Bohrung also vollständig freigelegt; darüber ändert sich der Luftdurchsatz
  nicht mehr.
- Der Bereich stammt unverändert aus der GUE-Excel und ist dort nur in den
  Calc-Tabellen vorhanden; die max-HD-Berechnung nutzt ausdrücklich 100 %.
- Offen: ob reale VHSx/PHBH/PHBL-Schieber überhaupt über die volle
  Bohrungsöffnung hinaus fahren.
- Praktisch prüfbar: Schieberhub bei voll gezogenem Gaszug messen und mit
  der Bohrungsweite vergleichen. Hub > Bohrung ⇒ echter Überhub.
- **Recherche 2026-11-01:** keine öffentliche Angabe zum Schieberhub von
  VHSx, PHBH oder PHBL gefunden. Dellortos Schieber-Nummern beschreiben nur
  den Ausschnitt in 1/10 mm, nicht den Hub
  (https://www.thisoldtractor.com/mg_manuals/dellorto_slide_numbers.pdf);
  die geprüften Theorie-Leitfäden (Laverdamania, Green Flag) nennen ihn
  ebenfalls nicht. Damit bleibt nur die Messung.
- Daten beibehalten, in UI und Charts als Extrapolation gekennzeichnet.
- **Entscheidung 2026-11-12 (Alexander):** Ob ein Schieber über die volle
  Bohrung hinaus fährt, hängt vom Modell ab und lässt sich nicht für einen
  Vergasertyp festlegen. Der Bereich 105–115 % bleibt als
  kalkulatorischer Faktor in der App (unverändert, weiter als
  Extrapolation gekennzeichnet; maxHD und Feinabstimmung nutzen ihn
  nicht). Eine Messung des Schieberhubs ist nicht mehr vorgesehen.
- Status: erledigt (kein offener Verifikationspunkt mehr).
