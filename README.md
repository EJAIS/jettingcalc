# Dellorto Jetting Calculator

Web port of *"Calculate Jetting for Dellorto Carbs v1.5"* — a browser-based jetting calculator for Dellorto carburetors (VHSA / VHSB / VHSC / VHSH, PHBH, and PHBL). Supports up to 5 parallel setups, visualizes the Needle Profile and Carb Profile as interactive charts, and allows saving custom needles locally. No server, no login, works fully offline.

## Usage

Open `index.html` in any modern browser. No build step, no server required.

> **Note:** Because the JS files use ES modules, browsers block them over `file://`. Serve locally with e.g. `python3 -m http.server 8080` and open `http://localhost:8080`.

- Select the **Carburetor Type** at the top: **VHSx** (VHSA / VHSB / VHSC / VHSH, needles K/U, atomizers DP/DQ), or, under **Beta Features**, **PHBH** (needles X, atomizers AV/AS) and **PHBL** (needles D, atomizer AQ). PHBH and PHBL are experimental — see the ℹ disclaimer next to each and the warning banner shown in the Setups section. This filters the available needle and atomizer options throughout the app.
- Fill in up to 5 setups in the table (Needle, Clip, Carb Ø, Jet Type, Needle Jet, ND, HD). Max HD is calculated and displayed automatically.
  - The **Clip** dropdown only offers the positions that actually exist on the selected needle. K-needles have 3, 4, or 5 positions depending on the specific needle, per the official Dellorto datasheet — not a uniform range. D-needles (PHBL) use a physically-verified 4-position default; X (PHBH) and U (VHSx) needles currently fall back to an unverified 4-position placeholder pending further research. See [KONSTANTEN_VERIFIKATION.md](KONSTANTEN_VERIFIKATION.md).
  - Use the ⧉ / ↺ icons on each row to duplicate a completed setup into the next empty slot, or reset a row back to empty.
- The **Needle Profile** chart shows needle diameter vs. throttle position (0–115%) for each active setup.
- The **Carb Profile** chart shows the blended equivalent flow (Overall HD) across the throttle range.
- Click any chart panel (or the ⛶ icon) to open a full-screen modal with a larger version of that chart. Close with ✕, a backdrop click, or Escape.
- Expand **Calculation Results** to inspect the raw per-throttle-point data for each setup — useful for verifying against the original Excel "Calc Data" sheets. For 2-stroke round-slide carbs (VHSx, PHBH, PHBL), each active setup also shows a **recommended slide cutaway** estimate and the needle-jet/main-jet area ratio. If the ratio falls outside the 0.45–0.80 target range, a warning is displayed instead of the cutaway value, indicating a likely needle jet / main jet mismatch. See the disclaimer note below.
- The **Carburetor cross-section** card visualizes the selected needle inside the venturi / needle-jet bore for a chosen setup, driven by a throttle slider (0–115%) with a live-updated diagram, annulus-area readout, and needle position/diameter readout.
- Use **Load Demo** to populate three example setups (K98-based).
- Use **Reset** to clear all setups back to empty.
- Toggle **Dark Mode / Light Mode** with the button in the header; preference is persisted in localStorage.
- Toggle the UI language between **English and German** with the DE/EN button in the header; preference is persisted in localStorage.
- Use the **Custom Needles** section to define additional needle profiles — with an interactive measurement schematic and field reference table — save them locally, and optionally submit them to the developer via email. Custom needles are stored separately and are never overwritten by app updates.
- Use the **Share** button in the Setups card header to generate a link that encodes the carburetor type and every non-empty setup — all in the URL itself, nothing is uploaded anywhere. Click **Copy link** to copy it (Clipboard API with a manual-selection fallback). Sharing is blocked, with an explanation of which setup(s)/needle(s) are affected, if any setup to be shared uses a custom needle (custom needles only exist locally for the person who created them, so a link referencing one would be broken for anyone else) or if no setup has a needle selected yet.
  - Opening a share link applies it automatically on page load, before anything else is rendered, and immediately strips the share parameters back out of the URL (any other query params or a `#hash` in the link are left alone) so reloading the page never re-applies it. An invalid or newer-version link leaves your current data untouched and shows a notice instead.
  - If the link doesn't change anything you already had, nothing happens. Otherwise, an **"Undo"** banner appears once above the Setups table; if you had setups of your own, it snapshots them in memory (not persisted) so **Undo** can restore them instantly. The banner also disappears on its own — without needing Undo — as soon as you make any change that moves your data away from what the link imported (a language toggle does not count as a change and does not dismiss it), or you can dismiss it directly with ✕.
  - See the ["Share links"](CLAUDE.md#share-links) section in CLAUDE.md for the URL schema, validation rules, and why custom needles can't be shared.

## Files

```
index.html          Main UI
css/style.css       Styling (dark mode capable)
js/needledb.js      Static needle database (read-only, 242 needles: K, U, X, D types)
js/calc.js          Calculation engine (1:1 port from Excel formulas)
js/cutaway.js       Slide cutaway heuristic (2-stroke round-slide carbs only)
js/storage.js       localStorage abstraction (setups + custom needles)
js/charts.js        Chart.js diagram rendering
js/i18n.js          EN/DE translations and language switching
js/share.js         Share-link encode/decode (pure module, no DOM/localStorage)
js/needlecatalog.js Needle catalog rows, filtering, sorting, formatting (pure module)
js/app.js           UI logic, event handling
js/vendor/          Vendored third-party scripts (Chart.js — see js/vendor/README.md)
sw.js               Service worker (offline support, update checking)
manifest.json       PWA manifest
icons/              PWA icons (192/512/maskable/apple-touch-icon)
scripts/            sync-sw-cache-version.mjs — derives sw.js's cache version from precached file content
.githooks/          Optional pre-commit hook that runs the script above automatically (see CLAUDE.md)
original/           Original unmodified Excel spreadsheet (for reference)
test/               Regression tests (Node's built-in test runner, zero dependencies)
test-browser/       Playwright browser tests (optional, see TESTING.md)
```

## Deployment

The app is static — copy the repo (minus `test/`, `test-browser/`,
`node_modules/`, `package.json`) to any web server. It's currently
deployed to a subdirectory on ejais.de, which is why `manifest.json`,
`sw.js`, and every path inside them use relative URLs throughout (see
`js/vendor/README.md` and `sw.js`'s own comments) rather than assuming a
domain root.

Two response headers matter for correct PWA behavior and are **server
configuration, not something this repo's code controls** — there's no
`.htaccess`/nginx config checked in here, so whoever configures the web
server needs to set these explicitly:

- **`manifest.json` → `Content-Type: application/manifest+json`.** Most
  default server configs (nginx included, unless a `.json` MIME type
  mapping is already in place) serve `.json` as `application/json`.
  Browsers tolerate that in practice, but it isn't spec-correct — the
  [Web App Manifest spec](https://www.w3.org/TR/appmanifest/) calls for
  `application/manifest+json`. For nginx, either add a `types` mapping or
  a per-location `default_type`:

  ```nginx
  location = /manifest.json {
    default_type application/manifest+json;
  }
  ```

- **`sw.js` → `Cache-Control: no-cache`** (or a short `max-age`, e.g. a
  few minutes). Browsers already throttle their own service-worker
  update checks to at most once per 24h regardless of HTTP caching
  headers — but a long server-side cache lifetime on `sw.js` itself
  (e.g. a blanket `Cache-Control: max-age=31536000` applied to all static
  assets) makes that worse: the browser may not even see the new
  `sw.js` bytes to compare against until its *own* cache entry expires,
  on top of the 24h throttle. `sw.js` is the one file in this repo that
  should never be far-future-cached, unlike everything under `js/vendor/`
  or `icons/` which are safe to cache aggressively since they're
  versioned by `JETTINGCALC_CACHE_VERSION`/filename instead. That version
  string is a generated content hash (see "Service worker cache
  versioning" below), not something to hand-edit before a release. For
  nginx:

  ```nginx
  location = /sw.js {
    add_header Cache-Control "no-cache";
  }
  ```

### Service worker cache versioning

`sw.js`'s `JETTINGCALC_CACHE_VERSION` (and therefore `CACHE_NAME`) is **not**
hand-maintained. It's a SHA-256 hash (first 12 hex chars) computed over the
relative path and byte content of every file listed in `PRECACHE_URLS`, so
it changes automatically whenever any precached file's content changes —
there's nothing to remember to bump.

```
npm run sync-sw-version
```

runs `scripts/sync-sw-cache-version.mjs`, which recomputes the hash and
rewrites the `JETTINGCALC_CACHE_VERSION` line in `sw.js` in place if it's
out of date (a no-op otherwise). Run it whenever a precached file changes —
before a release, or as part of your normal commit flow via the optional
`.githooks/pre-commit` hook (`git config core.hooksPath .githooks`, see
[CLAUDE.md](CLAUDE.md#git-hooks-optional-empfohlen)), which re-syncs and
re-stages `sw.js` automatically.

The hook is a convenience only — it can be bypassed with `--no-verify` and
isn't enabled by a fresh clone. The actual safety net is a `test/sw.test.mjs`
assertion (see below) that fails the next `node --test` run if
`JETTINGCALC_CACHE_VERSION` doesn't match the current file content, so a
forgotten sync can't silently ship a stale cache to already-installed users.

## Testing

Regression tests for the calculation engine live in `test/` and use Node's
built-in test runner — no dependencies, no build step, consistent with the
rest of the project:

```
node --test
```

`test/calc.test.mjs` guards the per-needle clip-groove geometry
(`CLIP_GEOMETRY_BY_COUNT` / `getClipGeometry()` in `js/needledb.js`, wired
into `calcSetup()`'s idle-position formula) against the values verified in
[KONSTANTEN_VERIFIKATION.md](KONSTANTEN_VERIFIKATION.md):

- 3-groove vs. 4-groove needles (K1 vs. K18) differ by exactly the measured
  top-offset delta (1.50 mm) at the same clip position.
- 5-groove needles (K98) use 1.0 mm clip spacing, so idlePos(clip 5) −
  idlePos(clip 1) is −4.0 mm (was −4.8 mm before the groove-count-aware
  geometry).
- The previously verified PHBL (D36) and PHBH (X2) idle positions — both
  4-groove reference needles — are unchanged, guarding against regressions
  in the already-measured `minExposed` / needle-length constants.

`test/share.test.mjs` covers `js/share.js` in isolation (it has no DOM or
localStorage dependency, so it runs directly under `node --test` like
`calc.test.mjs`): round-tripping setups (including the three demo setups,
a `carbSize` with a decimal like `39.5`, a partial setup, and umlauts/a
`<script>` tag in a name) through `encodeShare()`/`decodeShare()`, rejecting
an unknown version or carburetor type, dropping invalid fields with a
warning (including a `clipPos` beyond that needle's `getClipCount()`),
refusing to share a custom needle or a link with no active setups, and
`shareParamKeys()` covering every param key a real encoded link uses.

`test/sw.test.mjs` covers the pure, DOM-free parts of `sw.js` (the
service worker): the precache manifest — including a cross-check against
what `manifest.json`/`index.html` actually reference, not just a second
hand-maintained list — `isShareNavigation()` staying in sync with
`share.js`'s `hasShareParams()`, and (via
`scripts/sync-sw-cache-version.mjs`'s `computeCacheVersion()`) that
`JETTINGCALC_CACHE_VERSION` actually matches the current content of every
precached file — see "Service worker cache versioning" above.

`test/needlecatalog.test.mjs` covers `js/needlecatalog.js` (the pure
row/filter/sort/format logic behind the needle catalog, not yet wired into
the UI): one row per `NEEDLE_DB` entry of each carburetor type (counts
derived from the data, never hard-coded), taper count, needle length
(including the X37 override), clip count and its source
(verified / default / custom), custom needles overriding a base name,
`usedBy` for the demo setups, natural type ordering (`K9 < K10 < K98 <
K98-mod < U1`), filters and sorting (null values always last), a
format → `parseFloat` round-trip for every value in `NEEDLE_DB` (so data
with more decimals than displayed fails immediately), and that no function
mutates its deep-frozen inputs.

`test/i18n.test.mjs` is a standing guard for EN/DE completeness of the
whole app: `en` and `de` in `js/i18n.js` have identical key sets, no empty
values and identical `{placeholder}` sets per key, and every key used in
`index.html` (`data-i18n`, `-placeholder`, `-title`, `-aria-label`,
`-tooltip`) or in a literal `t('…')` call in `js/*.js` exists. Keys built
dynamically (template strings, variables) are not covered.

See [KONSTANTEN_VERIFIKATION.md](KONSTANTEN_VERIFIKATION.md) for the verification status of individual constants (needle geometry, clip-position counts, minimum exposed needle length, etc.) against sources beyond the original 2014 spreadsheet.

See [TESTING.md](TESTING.md) for the PWA-specific test coverage: the
Lighthouse installability audit, the Playwright browser test suite
(`test-browser/`, offline reload, share-link network-first behavior, the
update banner, the install button), and the manual checklist for what
only a real device can exercise (Android/iOS install, standalone
launch).

## Verification

Known-good values, verified against the original Excel formulas:

| Setup | maxHD (displayed as integer) |
|-------|------------------------------|
| #1 Demo-1 (K98, clip 3, NJ 262, DP) | 166 |
| #2 Demo-2 (K98, clip 1, NJ 268, DQ) | 166 |
| #3 Demo-3 (K98, clip 1, NJ 267, DQ) | 165 |

> **Note:** The original spreadsheet's Chart sheet has a copy-paste bug — the max-HD cells for setups 2 and 3 both reference setup 1's calculation table instead of their own, so the Excel itself displays 166 / 176 / 174 for these three setups. This port intentionally computes each setup from its own data and does **not** reproduce that bug; the values above are the corrected ones.

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
