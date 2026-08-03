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
- **Nummerierungsfehler:** Die als "K90" geführte Nadel (A:2.5, B:1.75, C:42)
  existiert unter dieser Nummer nicht in der offiziellen Eurocarb-Tabelle —
  die Werte gehören zu K96. "K90" wurde entfernt, die Werte liegen jetzt
  unter "K96".
- **Ergänzung:** K97 (A:2.50, B:1.80, C:44.5) war zuvor nicht in der
  Datenbank enthalten und wurde ergänzt.
- **Migration:** Gespeicherte Setups mit `needleType: "K90"` migrieren beim
  Laden automatisch auf `"K96"` (`storage.js` → `loadSetups()`), da die
  Geometrie identisch ist.

### D-Type-Nadeln (PHBL) — Eurocarb / Stein-Dinse

- Siehe Quellenangabe direkt im Code-Kommentar oberhalb der D-Nadeln in
  `js/needledb.js` ("Source: Eurocarb, cross-verified against Stein-Dinse
  handbook").

### `CLIP_SPACING` = 1.2 mm (D-Nadeln)

- **Datum:** 2026-08
- **Methode:** volle Spannweite über alle 4 Clip-Positionen an einem
  26 mm PHBL gemessen: 3.6 mm / 3 = 1.2 mm.
- **Befund:** bestätigt identisch zum Excel-Originalwert (VHSx).

### `NEEDLE_LENGTHS["D"]` = 52.0 mm

- **Datum:** 2026-08
- **Methode:** Direktmessung der Gesamtlänge einer D-Nadel.
- **Befund:** bestätigt.

### `minExposed` (`MIN_EXPOSED_BY_CARB_TYPE` in `js/calc.js`)

- **PHBL:** 16.3 mm — gemessen 2026-08 an einem 26 mm PHBL mit D36-Nadel
  und AQ-Mischrohr (idlePos 31.70 mm bei Clip 1), gegen eine unabhängige
  Messkette gegengeprüft. Siehe Verifikationswert in `js/calc.js`.
- **PHBH:** 26.4 mm — weiterhin von VHSx geerbt, NICHT unabhängig
  verifiziert.

---

## Noch zu verifizieren

- X-Type-Nadeln (PHBH, Serie 9477) — noch nicht gegen eine externe Quelle
  gegengeprüft.
- U-Type-Nadeln — noch nicht gegen eine externe Quelle gegengeprüft.
- Berechnungskonstanten in `js/calc.js` (Blend-Tabelle) — bislang nur gegen
  die Original-Excel-Formeln verifiziert, nicht gegen eine unabhängige
  Zweitquelle.
- `minExposed` für PHBH — weiterhin ungeprüft von VHSx geerbt (s.o.).
- Vergasergrößen-Term `(carbSize − 34)/2` für PHBL — Koeffizient ½ von VHSx
  geerbt, für PHBL nicht bestätigt; zur Klärung ist eine zweite
  idlePos-Messung bei einer anderen PHBL-Bohrungsgröße nötig (z.B. 20 oder
  22 mm).

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
