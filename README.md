# Dellorto Jetting Calculator

Web port of *"Calculate Jetting for Dellorto Carbs v1.5"* — a browser-based jetting calculator for Dellorto carburetors (VHSA / VHSB / VHSC / VHSH, PHBH, and PHBL). Supports up to 5 parallel setups, visualizes the Needle Profile and Carb Profile as interactive charts, and allows saving custom needles locally. No server, no login, works fully offline.

## Usage

Open `index.html` in any modern browser. No build step, no server required.

> **Note:** Because the JS files use ES modules, browsers block them over `file://`. Serve locally with e.g. `python3 -m http.server 8080` and open `http://localhost:8080`.

- Select the **Carburetor Type** at the top: **VHSx** (VHSA / VHSB / VHSC / VHSH, needles K/U, atomizers DP/DQ), **PHBH** (needles X, atomizers AV/AS), or **PHBL** (needles D, atomizer AQ). This filters the available needle and atomizer options throughout the app.
- Fill in up to 5 setups in the table (Needle, Clip 1–4, Carb Ø, Needle Jet, Jet Type, ND, HD). Max HD is calculated and displayed automatically.
- The **Needle Profile** chart shows needle diameter vs. throttle position (0–115%) for each active setup.
- The **Carb Profile** chart shows the blended equivalent flow (Overall HD) across the throttle range.
- Click any chart panel (or the ⛶ icon) to open a full-screen modal with a larger version of that chart. Close with ✕, a backdrop click, or Escape.
- Expand **Calculation Results** to inspect the raw per-throttle-point data for each setup — useful for verifying against the original Excel "Calc Data" sheets. For 2-stroke round-slide carbs (VHSx, PHBH, PHBL), each active setup also shows a **recommended slide cutaway** estimate and the needle-jet/main-jet area ratio. If the ratio falls outside the 0.45–0.80 target range, a warning is displayed instead of the cutaway value, indicating a likely needle jet / main jet mismatch. See the disclaimer note below.
- Use **Load Demo** to populate three example setups (K98-based).
- Use **Reset** to clear all setups back to empty.
- Toggle **Dark Mode / Light Mode** with the button in the header; preference is persisted in localStorage.
- Use the **Custom Needles** section to define additional needle profiles, save them locally, and optionally submit them to the developer via email. Custom needles are stored separately and are never overwritten by app updates.

## Files

```
index.html          Main UI
css/style.css       Styling (dark mode capable)
js/needledb.js      Static needle database (read-only, 235 needles: K, U, X, D types)
js/calc.js          Calculation engine (1:1 port from Excel formulas)
js/cutaway.js       Slide cutaway heuristic (2-stroke round-slide carbs only)
js/storage.js       localStorage abstraction (setups + custom needles)
js/charts.js        Chart.js diagram rendering
js/app.js           UI logic, event handling
original/           Original unmodified Excel spreadsheet (for reference)
```

## Verification

Known-good values against the original Excel:

| Setup | maxHD (displayed as integer) |
|-------|------------------------------|
| #1 Demo-1 (K98, clip 3, NJ 262, DP) | 166 |
| #2 Demo-2 (K98, clip 1, NJ 268, DQ) | 176 |
| #3 Demo-3 (K98, clip 1, NJ 267, DQ) | 174 |

## Cutaway calculation disclaimer

The recommended slide cutaway feature uses an unverified third-party heuristic
(M. Forrest, dragonfly75.com). The 0.6 target needle-jet/main-jet area ratio is
not an official Dellorto specification and has no published derivation. Treat the
result as a rough starting point only — confirm with real-world testing.

The calculation is intentionally omitted when the ratio falls outside 0.45–0.80,
as the estimate becomes unreliable when needle jet and main jet are poorly matched.

## Upstream copyright

This project is a web port of the Excel spreadsheet
"Calculate Jetting for Dellorto Carbs v1.5"

Copyright (C) 2014 GUE
Licensed under the GNU General Public License v2.0

The original spreadsheet is included unmodified at [/original/](original/) for reference and attribution purposes.

This web port is also released under GPL v2.0.
Source: https://github.com/EJAIS/jettingcalc

## Version history of original spreadsheet

```
v1.0: initial version
v1.1: added Carb profile, fixed Needle Data
v1.2: added support for DP and DQ needle Jets
v1.3: added 5th setup
v1.4: fixed DQ needle jet and needle clip offset, added basic carb size compensation
v1.5: added U-Type needle support, fixed Needle Data
```
