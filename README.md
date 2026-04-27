# Dellorto Jetting Calculator

Web port of *"Calculate Jetting for Dellorto Carbs v1.5"* — a browser-based jetting calculator for dedicated Dellorto carburetors. Supports up to 5 parallel setups, visualizes the Needle Profile and Carb Profile as interactive charts, and allows saving custom needles locally. No server, no login, works fully offline.

## Usage

Open `index.html` in any modern browser. No build step, no server required.

- Fill in up to 5 setups in the table (Needle, Clip position, Carb diameter, Needle Jet, Jet Type, ND, HD).
- The **Needle Profile** chart shows needle diameter vs. position for each active setup.
- The **Carb Profile** chart shows the blended equivalent flow (Overall HD) across the throttle range.
- Use **Load Demo** to populate three example setups from the original spreadsheet.
- Use the **Custom Needles** section to define, save locally, and optionally submit new needle profiles.

## Files

```
index.html          Main UI
css/style.css       Styling (dark mode capable)
js/needledb.js      Static needle database (read-only, 95 needles)
js/calc.js          Calculation engine (1:1 port from Excel formulas)
js/storage.js       localStorage abstraction (setups + custom needles)
js/charts.js        Chart.js diagram rendering
js/app.js           UI logic, event handling
original/           Original unmodified Excel spreadsheet (for reference)
```

## Verification

Known-good values against the original Excel:

| Setup | maxHD |
|-------|-------|
| #1 Simonini Grund (K98, clip 3, NJ 262, DP) | ≈ 166.49 |
| #2 Simonini 6.6.23 (K98, clip 1, NJ 268, DQ) | ≈ 175.78 |
| #3 Test (K98, clip 1, NJ 267, DQ) | ≈ 174.25 |

## Upstream copyright

This project is a web port of the Excel spreadsheet
"Calculate Jetting for Dellorto Carbs v1.5"

Copyright (C) 2014 GUE (Global Underwater Explorers)
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
