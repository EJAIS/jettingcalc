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

---

## Noch zu verifizieren

- X-Type-Nadeln (PHBH, Serie 9477) — noch nicht gegen eine externe Quelle
  gegengeprüft.
- U-Type-Nadeln — noch nicht gegen eine externe Quelle gegengeprüft.
- Berechnungskonstanten in `js/calc.js` (`CLIP_SPACING`, `MIN_EXPOSED`,
  Blend-Tabelle) — bislang nur gegen die Original-Excel-Formeln verifiziert,
  nicht gegen eine unabhängige Zweitquelle.
