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
- **PHBH:** 26.4 mm — weiterhin von VHSx geerbt, NICHT unabhängig
  verifiziert.

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
- minExposed für VHSx (K und U gemeinsam) — nie unabhängig gemessen,
  benötigt idlePos-Messung an einem realen VHSx-Vergaser.
- **U-Nadel Nut-Geometrie (Priorität MITTEL):** Spannmaß und Oberkante-
  Offset an U16 messen. Relevant, weil `minExposed.VHSx` für K und U
  gemeinsam gilt — weicht die U-Geometrie von der 4-Nut-K-Geometrie
  (1,2 / 1,60) ab, sind alle U-Nadeln um die Differenz versetzt. Ergebnis
  ggf. als Override-Felder `clipSpacing` / `clipTopOffset` an den
  U-Einträgen hinterlegen.
- **X-Nadel Nutabstand (Priorität NIEDRIG):** Spannmaß an X2 messen, um
  `spacing = 1,2` für PHBH zu bestätigen (bisher Annahme). Der
  Oberkante-Offset ist für X irrelevant, da `minExposed.PHBH` direkt
  mit X2 gemessen wurde.

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
- Status: offen — vor einer Änderung am Cutaway-Scope praktisch klären
  (Schieberform am realen VHS-Vergaser prüfen).
- **Bis dahin bewusst KEINE Änderung am Cutaway-Scope.**

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
- Bis dahin: Daten beibehalten, aber in UI und Charts als Extrapolation
  gekennzeichnet.
