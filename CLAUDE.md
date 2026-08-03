# Dellorto Jetting Calculator – WebApp

## Projektübersicht

Web-Portierung des Excel-basierten Dellorto Vergaser Jetting Calculators (v1.5).
Kein Build-Tool, kein Framework-Overhead – reines HTML/CSS/JavaScript, vollständig offline nutzbar.

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
dellorto-jetting/
├── index.html          # Haupt-UI
├── css/
│   └── style.css       # Styling (dark-mode-fähig)
├── js/
│   ├── needledb.js     # Statische Nadeldatenbank, schreibgeschützt (aus "Needle Data"-Sheet)
│   ├── calc.js         # Berechnungs-Engine (1:1 aus Excel-Formeln portiert)
│   ├── storage.js      # localStorage-Abstraktion (Setups + Custom Needles)
│   ├── charts.js       # Chart.js Diagramm-Rendering
│   └── app.js          # UI-Logik, Event-Handling
└── README.md
```

---

## Datenmodell – localStorage

**Key:** `dellorto_setups`  
**Format:**
```json
[
  {
    "id": 1,
    "name": "#1 Simonini Grund",
    "needleType": "K98",
    "clipPos": 3,
    "carbSize": 30,
    "needleJet": 262,
    "jetType": "DP",
    "nd": 53,
    "hd": 175
  },
  { "id": 2, ... },
  { "id": 3, ... },
  { "id": 4, ... },
  { "id": 5, ... }
]
```

**Regeln:**
- Immer genau 5 Slots (id 1–5), leere Slots haben `null` bei allen Feldern außer `id` und `name`.
- `nd` und `hd` sind User-Inputs (Haupt- und Leerlaufdüse), NICHT berechnet.
- `maxHD` wird bei Bedarf on-the-fly berechnet und NICHT gecacht.

**Initialisierung:**
```js
// storage.js
const STORAGE_KEY = 'dellorto_setups';
const DEFAULT_SETUPS = Array.from({length: 5}, (_, i) => ({
  id: i + 1, name: `#${i + 1}`, needleType: null, clipPos: null,
  carbSize: null, needleJet: null, jetType: null, nd: null, hd: null
}));

export function loadSetups() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_SETUPS;
}
export function saveSetups(setups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
}
```

---

## Nadeldatenbank – needledb.js

Statisches JS-Objekt. Vollständig aus dem "Needle Data"-Sheet extrahiert.

```js
// needledb.js

// Nadeln: { a, b, c } für 1 Taper; { a, b, c, d, e } für 2 Taper; { a, b, c, d, e, f } für 3 Taper
export const NEEDLE_DB = {
  "K1":  { a: 2.45, b: 1.75, c: 37 },
  "K2":  { a: 2.45, b: 1.75, c: 42 },
  "K3":  { a: 2.5,  b: 1.5,  c: 39 },
  "K4":  { a: 2.45, b: 1.5,  c: 39 },
  "K5":  { a: 2.45, b: 1.5,  c: 37 },
  "K6":  { a: 2.45, b: 1.75, c: 39 },
  "K7":  { a: 2.45, b: 1.25, c: 39 },
  "K8":  { a: 2.5,  b: 1.5,  c: 37 },
  "K9":  { a: 2.45, b: 1.5,  c: 42 },
  "K11": { a: 2.5,  b: 1.25, c: 39 },
  "K12": { a: 2.45, b: 1.75, c: 32 },
  "K13": { a: 2.45, b: 1.25, c: 36 },
  "K14": { a: 2.4,  b: 1.75, c: 33 },
  "K15": { a: 2.6,  b: 0.6,  c: 36 },
  "K16": { a: 2.6,  b: 1.75, c: 39 },
  "K17": { a: 2.42, b: 1.75, c: 40 },
  "K18": { a: 2.6,  b: 1.4,  c: 35 },
  "K19": { a: 2.5,  b: 1.4,  c: 40 },
  "K20": { a: 2.5,  b: 1.4,  c: 42 },
  "K21": { a: 2.5,  b: 1.8,  c: 38 },
  "K22": { a: 2.5,  b: 1.8,  c: 40 },
  "K23": { a: 2.5,  b: 1.8,  c: 42 },
  "K24": { a: 2.5,  b: 1.2,  c: 38, d: 2.13, e: 18 },
  "K25": { a: 2.5,  b: 1.0,  c: 36, d: 2.15, e: 18 },
  "K27": { a: 2.5,  b: 1.8,  c: 44 },
  "K28": { a: 2.5,  b: 1.8,  c: 41 },
  "K29": { a: 2.45, b: 1.25, c: 42 },
  "K30": { a: 2.5,  b: 1.4,  c: 36, d: 2.15, e: 18 },
  "K31": { a: 2.45, b: 1.5,  c: 36 },
  "K32": { a: 2.48, b: 1.7,  c: 44 },
  "K33": { a: 2.5,  b: 1.8,  c: 44 },
  "K34": { a: 2.5,  b: 1.4,  c: 40, d: 2.11, e: 18 },
  "K35": { a: 2.5,  b: 1.4,  c: 43 },
  "K36": { a: 2.5,  b: 1.4,  c: 38, d: 2.17, e: 20 },
  "K37": { a: 2.5,  b: 1.4,  c: 39, d: 2.12, e: 18 },
  "K38": { a: 2.5,  b: 1.4,  c: 38, d: 2.13, e: 18 },
  "K39": { a: 2.48, b: 1.45, c: 36, d: 2.28, e: 26 },
  "K40": { a: 2.5,  b: 1.4,  c: 40, d: 2.18, e: 22 },
  "K41": { a: 2.5,  b: 1.4,  c: 40, d: 2.14, e: 22 },
  "K42": { a: 2.5,  b: 1.4,  c: 38, d: 2.16, e: 22 },
  "K43": { a: 2.5,  b: 1.4,  c: 42, d: 2.16, e: 26 },
  "K44": { a: 2.5,  b: 1.4,  c: 39, d: 2.06, e: 20 },
  "K45": { a: 2.48, b: 1.3,  c: 36, d: 2.28, e: 26 },
  "K46": { a: 2.5,  b: 1.4,  c: 40, d: 2.15, e: 20 },
  "K48": { a: 2.48, b: 1.6,  c: 36, d: 2.25, e: 25, f: 11 },
  "K49": { a: 2.5,  b: 1.4,  c: 39, d: 2.2,  e: 26 },
  "K50": { a: 2.5,  b: 1.4,  c: 39, d: 2.27, e: 26 },
  "K51": { a: 2.52, b: 1.4,  c: 43 },
  "K52": { a: 2.5,  b: 1.6,  c: 36, d: 2.25, e: 25, f: 11 },
  "K53": { a: 2.52, b: 1.6,  c: 36, d: 2.25, e: 25, f: 11 },
  "K54": { a: 2.45, b: 1.5,  c: 40, d: 2.108, e: 18 },
  "K56": { a: 2.5,  b: 1.2,  c: 38, d: 2.17, e: 20 },
  "K57": { a: 2.5,  b: 1.4,  c: 37, d: 2.232, e: 25 },
  "K58": { a: 2.4,  b: 1.6,  c: 30, d: 2.25, e: 25, f: 11 },
  "K59": { a: 2.5,  b: 1.4,  c: 39, d: 2.23, e: 24 },
  "K60": { a: 2.46, b: 1.6,  c: 39, d: 2.13, e: 25, f: 11 },
  "K61": { a: 2.44, b: 1.6,  c: 39, d: 2.13, e: 26, f: 11 },
  "K62": { a: 2.48, b: 1.6,  c: 39, d: 2.13, e: 26, f: 11 },
  "K63": { a: 2.46, b: 1.6,  c: 39, d: 2.1,  e: 25, f: 11 },
  "K65": { a: 2.45, b: 1.6,  c: 39, d: 2.16, e: 25, f: 11 },
  "K66": { a: 2.44, b: 1.6,  c: 39, d: 2.16, e: 25, f: 11 },
  "K67": { a: 2.44, b: 1.6,  c: 39, d: 2.1,  e: 25, f: 11 },
  "K68": { a: 2.42, b: 1.6,  c: 39, d: 2.07, e: 26, f: 11 },
  "K69": { a: 2.48, b: 1.5,  c: 39, d: 2.1,  e: 25, f: 11 },
  "K70": { a: 2.42, b: 1.6,  c: 39, d: 2.04, e: 25, f: 11 },
  "K71": { a: 2.44, b: 1.6,  c: 39, d: 2.07, e: 25, f: 11 },
  "K72": { a: 2.5,  b: 1.2,  c: 38, d: 2.2,  e: 22 },
  "K76": { a: 2.46, b: 1.55, c: 39, d: 2.1,  e: 25, f: 11 },
  "K77": { a: 2.46, b: 1.6,  c: 39, d: 2.07, e: 25, f: 11 },
  "K78": { a: 2.48, b: 1.6,  c: 30, d: 2.07, e: 25, f: 11 },
  "K79": { a: 2.4,  b: 1.6,  c: 39, d: 2.07, e: 25, f: 11 },
  "K80": { a: 2.4,  b: 1.6,  c: 39 },
  "K81": { a: 2.44, b: 1.55, c: 39, d: 2.07, e: 25, f: 11 },
  "K82": { a: 2.48, b: 1.55, c: 39, d: 2.1,  e: 25, f: 11 },
  "K83": { a: 2.44, b: 1.55, c: 39, d: 2.04, e: 26, f: 11 },
  "K84": { a: 2.48, b: 1.6,  c: 39, d: 2.1,  e: 26, f: 11 },
  "K86": { a: 2.46, b: 1.6,  c: 39, d: 2.07, e: 26, f: 11 },
  "K87": { a: 2.48, b: 1.45, c: 39, d: 2.1,  e: 25, f: 11 },
  "K88": { a: 2.56, b: 1.43, c: 32.4, d: 2.12, e: 16.2 },
  "K89": { a: 2.48, b: 1.5,  c: 39, d: 2.07, e: 25, f: 11 },
  "K90": { a: 2.5,  b: 1.75, c: 42 },
  "K91": { a: 2.47, b: 1.4,  c: 39, d: 2.27, e: 26 },
  "K92": { a: 2.5,  b: 1.6,  c: 38 },
  "K93": { a: 2.5,  b: 1.6,  c: 40 },
  "K94": { a: 2.5,  b: 1.65, c: 38 },
  "K95": { a: 2.5,  b: 1.65, c: 40 },
  "K98": { a: 2.52, b: 1.8,  c: 41 },
  "U1":  { a: 2.46, b: 1.4,  c: 40 },
  "U2":  { a: 2.5,  b: 1.8,  c: 40 },
  "U3":  { a: 2.5,  b: 1.4,  c: 34 },
  "U4":  { a: 2.5,  b: 1.4,  c: 38 },
  "U5":  { a: 2.5,  b: 1.4,  c: 40 },
  "U6":  { a: 2.5,  b: 1.4,  c: 42 },
  "U7":  { a: 2.5,  b: 1.8,  c: 38 },
  "U8":  { a: 2.5,  b: 1.8,  c: 42 },
  "U9":  { a: 2.48, b: 1.0,  c: 28, d: 2.16, e: 18 },
  "U10": { a: 2.5,  b: 1.0,  c: 30, d: 2.06, e: 18 },
  "U11": { a: 2.5,  b: 1.0,  c: 28, d: 2.11, e: 16 },
  "U12": { a: 2.5,  b: 1.4,  c: 32 },
  "U13": { a: 2.45, b: 1.2,  c: 28 },
  "U14": { a: 2.48, b: 0.6,  c: 28, d: 2.23, e: 18 },
  "U15": { a: 2.5,  b: 1.2,  c: 32 },
  "U16": { a: 2.5,  b: 1.8,  c: 32 },
  "U17": { a: 2.5,  b: 0.6,  c: 35 },
  "U18": { a: 2.48, b: 1.0,  c: 34 },
  "U19": { a: 2.44, b: 1.0,  c: 32.5 },
  "U20": { a: 2.44, b: 1.0,  c: 34.5 },
  "U21": { a: 2.44, b: 1.0,  c: 36 },
  "U22": { a: 2.5,  b: 1.0,  c: 36.5 },
  "U23": { a: 2.46, b: 1.0,  c: 36.5 },
  "U24": { a: 2.46, b: 1.0,  c: 34 },
  "U25": { a: 2.48, b: 1.0,  c: 36.5 },
};

// Nadellänge nach Präfix
export const NEEDLE_LENGTHS = { "K": 73.5, "U": 68.0 };

// Needle-Jet Offset nach Düsentyp
export const JET_OFFSETS = {
  "DP": 0,   // VHSA/VHSB — short type (reference)
  "DQ": 2,   // VHSA/VHSB — long type (+2mm)
  "AV": 0,   // PHBH — short type (reference)
  "AS": 2,   // PHBH — long type (+2mm)
};
```

**Korrektur der K-Nadel-Werte (2026-08-03):** 19 K-Nadeln enthielten fehlerhafte A/B/C/D/E-Werte
(vermutlich Übernahmefehler aus einer minderwertigen Quelle im ursprünglichen 2014er GUE-Excel).
Die Werte wurden gegen die offizielle Eurocarb-Spezifikation (2015 Update) korrigiert und zusätzlich
gegen das Stein-Dinse Dellorto-Handbuch gegengeprüft. Betroffen: K12, K13, K14, K15, K16, K18, K54,
K57, K58, K61, K62, K65, K68, K69, K78, K79, K83, K84, K86. Außerdem wurde die fälschlich als "K90"
geführte Nadel (A:2.5, B:1.75, C:42) zu "K96" umbenannt — "K90" ist keine reale Dellorto-Bezeichnung
und existiert nicht mehr in `NEEDLE_DB`. Neu hinzugefügt: K97 (A:2.50, B:1.80, C:44.5). Details siehe
[KONSTANTEN_VERIFIKATION.md](KONSTANTEN_VERIFIKATION.md). Bestehende gespeicherte Setups mit
`needleType: "K90"` werden beim Laden automatisch und geräuschlos auf `"K96"` migriert
(`storage.js` → `loadSetups()`), da die zugrunde liegende Geometrie identisch ist.

---

## Berechnungs-Engine – calc.js

**Vollständig portiert aus den Excel-Formeln der "Calc Data"-Sheets.**

### Konstanten (hardcoded im Excel)
```
CLIP_SPACING = 1.2   mm (Abstand zwischen Klemmringnuten)
CLIP_MIN     = 1     (Dellorto standard: 4 Nuten, Wertebereich 1–4)
CLIP_MAX     = 4
MIN_EXPOSED  = 26.4  mm (Mindestlänge der exponierten Nadel bei Leerlauf, VHSx/K-U-Nadeln)
```

**MIN_EXPOSED ist seit 2026-08 familienspezifisch** (nicht mehr ein globaler
Wert). `calc.js` hält eine Lookup-Tabelle `MIN_EXPOSED_BY_CARB_TYPE`, die
über die `carbType`-Eigenschaft der jeweiligen Nadel aufgelöst wird (nicht
über den Nadel-Namens-Präfix, und nicht über die globale Vergaser-Typ-Einstellung
aus localStorage):

```
VHSx: 26.4 mm — Original-GUE-Excel-Wert (K/U-Nadeln)
PHBH: 26.4 mm — von VHSx geerbt, NICHT unabhängig verifiziert
PHBL: 16.3 mm — gemessen 2026-08 an einem 26 mm PHBL mit D36-Nadel und
                AQ-Mischrohr (idlePos 31.70 mm bei Clip 1), gegen eine
                unabhängige Messkette gegengeprüft. Siehe
                KONSTANTEN_VERIFIKATION.md.
```

### Formel: Nadelposition bei Leerlauf (Excel-Zelle B7)
```
Excel: =B6 - B5 - (B3-1)*B4 + B18 + (B2-34)/2
```
```js
const needleLength  = NEEDLE_LENGTHS[needleType[0]];       // K→73.5, U→68
const needleOffset  = JET_OFFSETS[jetType];                // DP/AV→0, DQ/AS→2
const minExposed    = MIN_EXPOSED_BY_CARB_TYPE[needle.carbType] ?? MIN_EXPOSED_DEFAULT;
const idlePos = needleLength - minExposed
              - (clipPos - 1) * CLIP_SPACING
              + needleOffset
              + (carbSize - 34) / 2;
```

**Verifikation (VHSx):** K98, Clip 3, Carb 30, DP → 73.5 - 26.4 - 2.4 + 0 + (-2) = 42.7 ✓
**Verifikation (PHBL):** D36, Clip 1, Carb 26, AQ → 52.0 - 16.3 - 0 + 0 + (-4) = 31.7 ✓

### Formel: Anzahl Taper (Excel-Zelle B14)
```
Excel: =IF(B13,3,IF(B12,2,1))   (B12=e, B13=f)
```
```js
const tapers = (needle.f) ? 3 : (needle.e) ? 2 : 1;
```

### Formeln: Taper-Parameter (Excel-Zeilen 21–22)

**Taper 1 k-Wert (Steigung):**
```
Excel: =IF(B$14=1, (B$8-B$9)/B$10, (B$8-B$11)/(B$10-B$12))
       (a=B8, b=B9, c=B10, d=B11, e=B12)
```
```js
const t1_k = (tapers === 1)
  ? (needle.a - needle.b) / needle.c
  : (needle.a - needle.d) / (needle.c - needle.e);
```

**Taper 1 Durchmesser-Startpunkt:**
```
Excel: =IF(B$14=1, B$9, B$11)
```
```js
const t1_d = (tapers === 1) ? needle.b : needle.d;
```

**Taper 2 k-Wert:**
```
Excel: =IF(B$14=1, 0, (B$11-B$9)/(B$12-B$13))
       (d=B11, b=B9, e=B12, f=B13)
```
```js
const t2_k = (tapers === 1) ? 0
  : (needle.d - needle.b) / (needle.e - (needle.f || 0));
```

### Formel: Nadeldurchmesser bei Position `pos` (Excel-Spalte C)
```
Excel: =IF(pos>c, a,
         IF(pos<0, 0,
           IF(pos<f, b,
             IF(pos<=e, t2_k*(pos-f)+b,
               t1_k*(pos-e)+t1_d))))
```

Für 1-Taper Nadeln: f=0, e=0, t2_k=0 → vereinfacht zu: `t1_k * pos + b`

```js
function needleDiameter(pos, needle, t1_k, t1_d, t2_k) {
  const { a, b, c } = needle;
  const e = needle.e || 0;
  const f = needle.f || 0;
  if (pos > c)   return a;
  if (pos < 0)   return 0;
  if (pos < f)   return b;
  if (pos <= e)  return t2_k * (pos - f) + b;
  return t1_k * (pos - e) + t1_d;
}
```

### Formel: HD-Äquivalent (Excel-Spalte D)
```
Excel: =SQRT(needleJet^2 - (needleDiam*100)^2)
```
```js
const hdEquiv = Math.sqrt(needleJet ** 2 - (diam * 100) ** 2);
```

### Formel: "Overall" Kennlinie (Excel-Spalte E)

Blending von Leerlaufdüse (ND) und HD-Äquivalent über den Drosselbereich:

```
Throttle 0.00: ND * 1.00 + hdEquiv * 0.00  → = ND
Throttle 0.05: ND * 0.80 + hdEquiv * 0.20
Throttle 0.10: ND * 0.60 + hdEquiv * 0.40
Throttle 0.15: ND * 0.40 + hdEquiv * 0.60
Throttle 0.20: ND * 0.20 + hdEquiv * 0.80
Throttle 0.25: ND * 0.10 + hdEquiv * 0.90
Throttle 0.30: ND * 0.05 + hdEquiv * 0.95
Throttle 0.35+: MIN(HD, hdEquiv)            → durch Hauptdüse begrenzt
```

### Vollständige Setup-Berechnung

```js
// calc.js
import { NEEDLE_DB, NEEDLE_LENGTHS, JET_OFFSETS } from './needledb.js';

const CLIP_SPACING = 1.2;
const CLIP_MIN = 1;          // Dellorto standard: 4 clip positions
const CLIP_MAX = 4;
const MIN_EXPOSED_BY_CARB_TYPE = { VHSx: 26.4, PHBH: 26.4, PHBL: 16.3 };
const MIN_EXPOSED_DEFAULT = 26.4;
const THROTTLE_POINTS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45,
                          0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95,
                          1.0, 1.05, 1.1, 1.15];

const BLEND = {
  0: [1, 0], 0.05: [0.8, 0.2], 0.1: [0.6, 0.4], 0.15: [0.4, 0.6],
  0.2: [0.2, 0.8], 0.25: [0.1, 0.9], 0.3: [0.05, 0.95]
};

export function calcSetup(setup) {
  const { needleType, clipPos, carbSize, needleJet, jetType, nd, hd } = setup;
  if (!needleType || !NEEDLE_DB[needleType]) return null;

  const needle = NEEDLE_DB[needleType];
  const needleLength = NEEDLE_LENGTHS[needleType[0]];
  const needleOffset = JET_OFFSETS[jetType] ?? 0;
  const tapers = needle.f ? 3 : needle.e ? 2 : 1;

  const t1_k = tapers === 1
    ? (needle.a - needle.b) / needle.c
    : (needle.a - needle.d) / (needle.c - needle.e);
  const t1_d = tapers === 1 ? needle.b : needle.d;
  const t2_k = tapers === 1 ? 0 : (needle.d - needle.b) / (needle.e - (needle.f || 0));

  const minExposed = MIN_EXPOSED_BY_CARB_TYPE[needle.carbType] ?? MIN_EXPOSED_DEFAULT;
  const idlePos = needleLength - minExposed
    - (clipPos - 1) * CLIP_SPACING
    + needleOffset
    + (carbSize - 34) / 2;

  const curve = THROTTLE_POINTS.map(tp => {
    const pos   = idlePos - tp * carbSize;
    const e     = needle.e || 0;
    const f     = needle.f || 0;
    let diam;
    if (pos > needle.c)  diam = needle.a;
    else if (pos < 0)    diam = 0;
    else if (pos < f)    diam = needle.b;
    else if (pos <= e)   diam = t2_k * (pos - f) + needle.b;
    else                 diam = t1_k * (pos - e) + t1_d;

    const hdEquiv = Math.sqrt(needleJet ** 2 - (diam * 100) ** 2);

    let overall;
    if (BLEND[tp]) {
      const [wNd, wHd] = BLEND[tp];
      overall = nd * wNd + hdEquiv * wHd;
    } else {
      overall = Math.min(hd, hdEquiv);
    }

    return { tp, pos, diam, hdEquiv, overall };
  });

  // "max HD" is evaluated at 100% throttle (WOT), matching the original
  // spreadsheet — NOT the maximum across the whole curve, since hdEquiv
  // keeps rising into the 100–115% extrapolated range.
  const wot = curve.find(p => Math.abs(p.tp - 1.0) < 1e-9);
  const maxHD = wot ? wot.hdEquiv : Math.max(...curve.map(p => p.hdEquiv));

  return { idlePos, tapers, t1_k, t1_d, t2_k, curve, maxHD };
}
```

**Deliberate deviation from the original Excel (max HD, 2026-08):** The original
spreadsheet's Chart sheet has a copy-paste bug — cells G5, G6 and G7 (max HD for
setups 1–3) all reference `'Calc Data 1'!$C$45` absolutely, so setups 2 and 3 are
actually computed from setup 1's needle diameter at 100% throttle instead of
their own. This is why the Excel shows 166 / 176 / 174 for the three demo
setups instead of the correct 166 / 166 / 165. Our port intentionally uses
each setup's own curve (`'Calc Data N'` equivalent) and does NOT reproduce
this bug.

```js
  const needle = NEEDLE_DB[needleType];
  if (!needle) return [];
  const pts = [];
  for (let pos = 0; pos <= needle.c + 2; pos += 0.5) {
    const e = needle.e || 0;
    const f = needle.f || 0;
    const t1_k = needle.e ? (needle.a - needle.d) / (needle.c - needle.e) : (needle.a - needle.b) / needle.c;
    const t1_d = needle.e ? needle.d : needle.b;
    const t2_k = needle.e ? (needle.d - needle.b) / (needle.e - (needle.f || 0)) : 0;
    let diam;
    if (pos > needle.c)  diam = needle.a;
    else if (pos < f)    diam = needle.b;
    else if (pos <= e)   diam = t2_k * (pos - f) + needle.b;
    else                 diam = t1_k * (pos - e) + t1_d;
    pts.push({ pos, diam });
  }
  return pts;
}
```

---

## UI – index.html

### Bereiche

1. **Header:** Titel, Copyright-Hinweis
2. **Setups-Tabelle** (entspricht Chart!A4:I9):
   - 5 Zeilen, editierbar
   - Spalten: Name | Nadel | Clip | Vergaser Ø | Düse | Typ | max HD (berechnet) | ND | HD
   - Inline-Editierung: Klick auf Feld → Edit-Modus
   - Nadel-Auswahl als Dropdown (`<select>` aus NEEDLE_DB keys)
   - Clip-Position: Dropdown oder Spinner, Wertebereich **1–4** (Dellorto standard: 4 Nuten)
   - Typ-Auswahl: DP / DQ / AV / AS
3. **"Needle Profile"-Graph** (Chart.js Line)
   - X-Achse: Nadelposition (mm, von 0 bis max c)
   - Y-Achse: Nadeldurchmesser (mm)
   - Eine Linie pro aktivem Setup
4. **"Carb Profile"-Graph** (Chart.js Line)
   - X-Achse: Gasstellung (0–1, in 5%-Schritten)
   - Y-Achse: "Overall" Durchflusswert
   - Eine Linie pro aktivem Setup

### Farbschema (max. 5 Setups)
```js
const COLORS = [
  '#2e8b7a', '#e07b39', '#6a5acd', '#c0392b', '#27ae60'
];
```

---

## Charts – charts.js

```js
// charts.js
import { calcSetup, calcNeedleProfile } from './calc.js';

let needleChart = null;
let carbChart   = null;

const COLORS = ['#2e8b7a', '#e07b39', '#6a5acd', '#c0392b', '#27ae60'];

export function renderCharts(setups) {
  const activeSetups = setups.filter(s => s.needleType);

  // --- Needle Profile ---
  const needleDatasets = activeSetups.map((s, i) => ({
    label: s.name,
    data: calcNeedleProfile(s.needleType).map(p => ({ x: p.pos, y: p.diam })),
    borderColor: COLORS[s.id - 1],
    tension: 0.3,
    pointRadius: 0,
  }));

  if (needleChart) needleChart.destroy();
  needleChart = new Chart(document.getElementById('needleChart'), {
    type: 'line',
    data: { datasets: needleDatasets },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Nadelposition (mm)' } },
        y: { title: { display: true, text: 'Nadeldurchmesser (mm)' } },
      }
    }
  });

  // --- Carb Profile ---
  const carbDatasets = activeSetups.map((s, i) => {
    const result = calcSetup(s);
    if (!result) return null;
    return {
      label: s.name,
      data: result.curve.map(p => ({ x: p.tp, y: p.overall })),
      borderColor: COLORS[s.id - 1],
      tension: 0.3,
      pointRadius: 2,
    };
  }).filter(Boolean);

  if (carbChart) carbChart.destroy();
  carbChart = new Chart(document.getElementById('carbChart'), {
    type: 'line',
    data: { datasets: carbDatasets },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Gasstellung' },
             min: 0, max: 1.15, ticks: { callback: v => (v * 100).toFixed(0) + '%' } },
        y: { title: { display: true, text: 'Equivalent HD' } },
      }
    }
  });
}
```

---

## app.js – Haupt-Logik

```js
// app.js
import { loadSetups, saveSetups } from './storage.js';
import { calcSetup } from './calc.js';
import { renderCharts } from './charts.js';
import { NEEDLE_DB } from './needledb.js';

let setups = loadSetups();

function updateUI() {
  renderTable();
  renderCharts(setups);
}

function renderTable() {
  setups.forEach((s, i) => {
    // Berechneten maxHD eintragen
    const result = s.needleType ? calcSetup(s) : null;
    const maxHD = result ? Math.round(result.maxHD) : '–';
    document.getElementById(`row-${i}-maxhd`).textContent = maxHD;
  });
}

function handleFieldChange(id, field, value) {
  const idx = setups.findIndex(s => s.id === id);
  setups[idx][field] = field === 'name' ? value : (isNaN(value) ? value : parseFloat(value));
  saveSetups(setups);
  updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  // Event-Delegation für Inline-Editing
  document.getElementById('setup-table').addEventListener('change', e => {
    const cell = e.target.closest('[data-id][data-field]');
    if (!cell) return;
    handleFieldChange(parseInt(cell.dataset.id), cell.dataset.field, e.target.value);
  });
});
```

---

## CDN-Abhängigkeiten (kein npm nötig)

```html
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

---

## Vorgefertigte Daten aus der Excel (als Startwerte)

Folgende 3 Setups aus dem Original-Chart-Sheet können als Standardwerte geladen werden:

```js
const DEMO_SETUPS = [
  { id:1, name:"#1 Simonini Grund", needleType:"K98", clipPos:3, carbSize:30, needleJet:262, jetType:"DP", nd:53, hd:175 },
  { id:2, name:"#2 Simonini 6.6.23", needleType:"K98", clipPos:1, carbSize:30, needleJet:268, jetType:"DQ", nd:53, hd:155 },
  { id:3, name:"#3 Test",            needleType:"K98", clipPos:1, carbSize:30, needleJet:267, jetType:"DQ", nd:55, hd:155 },
  { id:4, name:"#4", needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
  { id:5, name:"#5", needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
];
```

**Alle berechneten maxHD-Werte zur Verifikation (unsere Implementierung, je Setup
eigene Kurve bei 100% Gasstellung):**
- Setup 1: maxHD = 166 (rounded)
- Setup 2: maxHD = 166 (rounded)
- Setup 3: maxHD = 165 (rounded)

Die Original-Excel zeigt stattdessen 166 / 176 / 174 — bedingt durch den oben
beschriebenen Copy-Paste-Fehler (G5/G6/G7 referenzieren alle absolut
`'Calc Data 1'!$C$45`, statt je Setup die eigene Calc-Data-Tabelle). Das ist
kein Portierungsfehler, sondern eine bewusste Korrektur.



---

## Benutzerdefinierte Nadeln (Custom Needles)

### Zwei-Schichten-Modell

`needledb.js` ist **schreibgeschützt** und enthält die 95 bekannten Originalnadeln. Eigene Nadeln werden separat in localStorage gespeichert und nie durch App-Updates überschrieben.

**Key:** `dellorto_custom_needles`  
**Format:**
```json
[
  { "type": "K99", "a": 2.50, "b": 1.60, "c": 40, "d": null, "e": null, "f": null }
]
```

**Zusammenführung in `storage.js`:**
```js
export function getAllNeedles() {
  const custom = loadCustomNeedles();  // aus localStorage
  return { ...NEEDLE_DB, ...Object.fromEntries(custom.map(n => [n.type, n])) };
}
// Custom Needles überschreiben im Konfliktfall die Basisdatenbank
```

### UI – Custom Needle Formular

Eigener Bereich in der UI (z.B. Tab oder aufklappbarer Abschnitt) mit:

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| Type | ✅ | z.B. `K99` – muss eindeutig sein |
| a    | ✅ | Maximaldurchmesser (mm) |
| b    | ✅ | Minimaldurchmesser (mm) |
| c    | ✅ | Taper-Startposition (mm) |
| d    | ☐  | 2. Taper: Durchmesser am Übergangspunkt |
| e    | ☐  | 2. Taper: Position des Übergangspunkts |
| f    | ☐  | 3. Taper: Startposition |

Validierung: `type` darf nicht bereits in `NEEDLE_DB` existieren. `d/e` müssen gemeinsam befüllt sein. `f` nur wenn `d/e` vorhanden.

### Submit-Button – Nadel per E-Mail einreichen

Neben dem lokalen Speichern gibt es einen **"Submit to Developer"**-Button. Beim Klick liest er die aktuellen Formularwerte aus und öffnet den E-Mail-Client mit vorausgefülltem Body:

```js
function buildMailtoLink(needle) {
  const subject = encodeURIComponent(`Custom Needle Submission: ${needle.type}`);
  const body = encodeURIComponent(
    `Needle Type: ${needle.type}\r\n` +
    `a: ${needle.a}\r\n` +
    `b: ${needle.b}\r\n` +
    `c: ${needle.c}\r\n` +
    `d (optional): ${needle.d ?? ''}\r\n` +
    `e (optional): ${needle.e ?? ''}\r\n` +
    `f (optional): ${needle.f ?? ''}\r\n` +
    `\r\nSource / Reference (optional):\r\n`
  );
  return `mailto:jetting@ejais.de?subject=${subject}&body=${body}`;
}

// Im Click-Handler:
document.getElementById('btn-submit-needle').addEventListener('click', () => {
  const needle = readNeedleForm();  // Formularwerte auslesen
  if (!validateNeedle(needle)) return;
  window.location.href = buildMailtoLink(needle);
});
```

Das öffnet den Standard-E-Mail-Client des Users (Outlook, Gmail, Apple Mail, Thunderbird …) mit vorausgefülltem Empfänger `jetting@ejais.de`, Betreff und Nadelwerten im Body. Kein Server, kein API-Key erforderlich.

---

## Copyright & Attribution

### Ursprung

Die Berechnungslogik basiert auf dem Excel-Tool *"Calculate Jetting for Dellorto Carbs v1.5"*, erstellt von **GUE (Global Underwater Explorers)**, veröffentlicht 2014 unter der **GNU General Public License v2.0**.

**Wichtig:** GUE (Global Underwater Explorers) ist der Rechteinhaber — nicht Michael Forrest / dragonfly75.com, der einen eigenständigen, kostenpflichtigen Dellorto-Calculator betreibt.

**Versionshistorie des Originals (aus Excel-Kommentaren):**
```
v1.0: initial version
v1.1: added Carb profile, fixed Needle Data
v1.2: added support for DP and DQ needle Jets
v1.3: added 5th setup
v1.4: fixed DQ needle jet and needle clip offset, added basic carb size compensation
v1.5: added U-Type needle support, fixed Needle Data
```

### Pflicht-Footer in der WebApp

Jede Seite der WebApp muss folgenden Footer enthalten:

```html
<footer>
  Based on "Calculate Jetting for Dellorto Carbs v1.5"<br>
  Copyright (C) 2014 GUE (Global Underwater Explorers) –
  Licensed under <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL v2.0</a><br>
  Web port: <a href="https://github.com/EJAIS/jettingcalc">github.com/EJAIS/jettingcalc</a>
</footer>
```

Da die WebApp eine Portierung eines GPL v2-Werks ist, steht auch die WebApp unter **GPL v2.0** (Copyleft). Der Quellcode muss öffentlich zugänglich sein.

---

## README.md – Inhalt für Claude Code

Claude Code soll eine vollständige `README.md` generieren. Folgende Pflichtinhalte müssen enthalten sein:

### Kurzbeschreibung
> Web port of *"Calculate Jetting for Dellorto Carbs v1.5"* — a browser-based jetting calculator for Dellorto carburetors (PHBN, PHBG, PHBL, PHBE, PHBH). Supports up to 5 parallel setups, visualizes the Needle Profile and Carb Profile as interactive charts, and allows saving custom needles locally. No server, no login, works fully offline.

### Upstream-Copyright (muss wörtlich in der README stehen)
```
This project is a web port of the Excel spreadsheet
"Calculate Jetting for Dellorto Carbs v1.5"

Copyright (C) 2014 GUE (Global Underwater Explorers)
Licensed under the GNU General Public License v2.0

The original spreadsheet is included unmodified at /original/
for reference and attribution purposes.

This web port is also released under GPL v2.0.
Source: https://github.com/EJAIS/jettingcalc
```

### Originaldatei
Die unveränderte Original-Excel liegt im Repository unter `/original/` und wird in der README verlinkt.

---

## Entwicklungsreihenfolge (aktualisiert)

1. `needledb.js` – statische Daten einfügen
2. `calc.js` – Engine implementieren + Werte gegen Excel verifizieren
3. `storage.js` – localStorage-Wrapper (Setups + Custom Needles)
4. `index.html` – Grundstruktur mit Tabelle, Chart-Canvas, Custom-Needle-Formular + Footer
5. `charts.js` – Chart.js Diagramme
6. `app.js` – Alles verbinden inkl. mailto Submit-Button
7. `style.css` – Styling + Dark Mode