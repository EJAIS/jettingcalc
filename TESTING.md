# Testing

This project's calculation-engine and share-link unit tests are covered in
[README.md](README.md#testing) — start there for `test/*.test.mjs` (Node's
built-in test runner, zero dependencies, run with `node --test`).

This file covers everything that needs a real browser: the Lighthouse
installability audit, the Playwright browser test suite (PWA behavior,
needle catalog, carburetor type selector, custom needle migration, fine
tuning), and the manual checklists for scenarios no headless browser can
exercise (a real install prompt, an actual home-screen launch, fine tuning
on a real phone).

## Lighthouse PWA audit

Lighthouse dropped its dedicated `pwa` category/scored audits in v12
(installability is now checked via Chrome DevTools' Application panel
instead), so the classic PWA report below used the last version that
still has it, **Lighthouse 11.7.1**, against a local static server:

```
python3 -m http.server 8080
npx lighthouse@11 http://localhost:8080/index.html --only-categories=pwa \
  --chrome-flags="--headless=new"
```

**Result: PWA score 100/100, both mobile and desktop presets, no hard
installability blockers.**

| Audit | Result |
|---|---|
| `installable-manifest` — manifest + service worker meet installability requirements | ✅ Pass |
| `splash-screen` — configured for a custom splash screen | ✅ Pass |
| `themed-omnibox` — sets a theme color for the address bar | ✅ Pass |
| `viewport` — has a `<meta name="viewport">` with `width`/`initial-scale` | ✅ Pass |
| `content-width` — content sized correctly for the viewport (mobile only) | ✅ Pass |
| `maskable-icon` — manifest has a maskable icon | ✅ Pass |
| `pwa-cross-browser`, `pwa-page-transitions`, `pwa-each-page-has-url` | Manual audits (not auto-scored) — not evaluated here, see the manual checklist below for the closest equivalents |

If a future Lighthouse run ever fails `installable-manifest`, the usual
causes are: `manifest.json` returning a non-200/non-JSON response,
`sw.js` failing to register, no icon ≥192px, or `start_url` not being
reachable — check those first via Chrome DevTools → Application →
Manifest, which replaced the old scored audit and gives a precise reason.

## Playwright browser tests (`test-browser/`)

Unlike `test/*.test.mjs`, these need a real Chromium and the `playwright`
package, so they live outside `test/` on purpose — a directory literally
named `test` is auto-discovered by a bare `node --test` regardless of the
files' own naming, which would break the zero-dependency default test run
for anyone who hasn't installed Playwright. Run them explicitly:

```
npm install                       # pulls in the playwright devDependency only —
                                   # the app itself still has zero runtime dependencies
npx playwright install chromium   # first time and after every Playwright update
node --test test-browser/*.mjs
```

After an update of the `playwright` package (e.g. a fresh `npm install`
that pulls a newer version), run `npx playwright install chromium` again:
each Playwright version expects its own Chromium build, and without it the
tests fail at launch with "Executable doesn't exist at …/ms-playwright/…".
`CHROMIUM_PATH` (see the end of this section) remains the alternative for
environments that can't download the browser.

Each test spins up its own throwaway static file server (serving the repo
root, equivalent to `python3 -m http.server`) and its own isolated
browser context, so they don't share service-worker/cache state.

`test-browser/pwa.mjs` covers:

- **Offline reload** — fresh load, populate a setup (Load Demo), go
  offline (`context.setOffline(true)`), reload: the page, both charts
  (`Chart.instances`), and the persisted setup data all still render.
  The first load goes to `./index.html`, which the worker does not yet
  control and so never caches; the reload is answered by the navigation
  fallback to the precached app shell (`navigationCacheFirst()` in
  `sw.js`).
- **Offline navigation to an uncached URL** — online visit of `./`, then
  offline direct navigation to `./index.html?foo=bar` (neither path nor
  query was ever cached): the app shell renders fully, charts included.
- **Online 404 stays a 404** — with the worker in control, navigating to
  `./does-not-exist.html` returns the server's 404, not the app shell;
  the fallback applies only when the network is unreachable.
- **Share link online is network-first** — poisons the cache with a fake
  stale response under the *exact* share-link URL, then navigates to it
  and asserts the live network response won (not the poisoned cache
  entry) and the link still decoded correctly. This is a stronger check
  than just observing that a network request fired, since a cache-first
  strategy would also fire a request on a cache miss — poisoning the
  cache first is what actually distinguishes network-first from
  cache-first.
- **Share link while offline** — mocks `navigator.onLine = false` (more
  reliable than `context.setOffline()`, which doesn't consistently reach
  fetches issued from inside the service worker's own execution context)
  and asserts `msg.shareOfflineStaleWarning` appears *and* the import
  still went through (the banner, the decoded setup) — the warning is
  additive, not a rejection.
- **Waiting service worker → update banner → "Update now"** — bumps
  `JETTINGCALC_CACHE_VERSION` in `sw.js` on disk (restored in a `finally`)
  to simulate a real new deploy, reloads, polls for `registration.waiting`
  (sw.js deliberately never auto-`skipWaiting()`s), asserts the update
  banner appears, clicks "Update now", and asserts the page reloads under
  the new worker with the old cache replaced (not left alongside the new
  one).
- **Install button hidden when already "installed"** — mocks
  `matchMedia('(display-mode: standalone)')` to `true` and asserts
  `#btn-install` stays hidden even when a real `beforeinstallprompt` is
  dispatched.

All 7 pass. The offline reload test was red until the navigation
fallback was added (branch `bugfix/sw-navigation-fallback`).

`test-browser/catalog.mjs` covers the needle catalog view (service
workers are blocked there — the tests are about the UI, not caching):

- **Tabs and history** — clicking the catalog tab sets `#needles` and
  swaps the panels, `history.back()` returns to the calculator with an
  empty hash, a direct load with `#needles` opens the catalog, and
  ArrowLeft/ArrowRight move between the tabs.
- **No raw i18n keys** — in EN and DE, with demo setups and a custom
  needle loaded, for VHSx and PHBH: no `view.*`/`catalog.*` key appears
  in the visible text or in any `title`, `aria-label` or `placeholder`
  of the tab bar and `#view-needles`.
- **Isolation** — switching the catalog to PHBL leaves the calculator's
  carb-type radio and the `dellorto_carb_type` / `dellorto_setups`
  localStorage values untouched.
- **Setups and filters** — after Load Demo, K98 shows three setup dots and
  "My setups only" leaves exactly one row.
- **Search** — typing `" k 98 "` finds K98 and focus stays in the search
  box (also with no matches and the empty state shown).
- **Phone layout (390×844)** — horizontally scrolling `#catalog-scroll`
  leaves the sticky first column at the same x position, and the page
  itself has no horizontal overflow.

`test-browser/custom-needles.mjs` covers the one-time startup migration
of stored custom needle lengths (service workers blocked as above), once
in EN and once in DE:

- **Migration** — with a custom PHBH needle stored at 68 mm and one
  without `length`, the page load shows the `msg.customLengthMigrated`
  notice (translated, no raw key or placeholder) and localStorage holds
  55 mm for both.
- **Catalog** — the PHBH catalog lists both needles with length `55.0`.
- **Idempotence** — a reload shows no notice and leaves the values as is.

`test-browser/carb-selector.mjs` covers the carburetor type selector
(service workers blocked as above), each case in EN and DE:

- **Portrait 412×915** — the "Beta" heading sits above PHBH and PHBL;
  PHBH and PHBL share one row (same y ± 2 px), side by side; each ⓘ sits
  right of its option in the same row; VHSx spans the selector's content
  box; all three options are ≥ 44 px tall; no element sticks out of the
  selector and the page has no horizontal overflow.
- **Narrow 320×640** — no horizontal overflow, PHBH and PHBL still in
  one row.
- **Landscape 915×412 and desktop 1280×800** — VHSx, beta label, PHBH and
  PHBL in one row, in the order VHSx, PHBH, ⓘ, PHBL, ⓘ (layout as before).
  Between 601 and 1023 px the selector uses slightly less padding and gap,
  so the row also fits with fonts wider than Segoe UI (Noto Sans on Linux,
  Roboto on Android); the 915 px case failed there before by ~3 px.
- **Tap area** — the point 15 px right of the PHBH ⓘ's centre hit-tests to
  the icon (`elementFromPoint`; a tap alone isn't proof, since Chromium's
  touch adjustment snaps taps to nearby targets), and a touch tap there
  opens its tooltip. A tap on PHBL's left edge still selects PHBL; on
  desktop the edges of PHBH and PHBL next to the ⓘ still hit the options,
  and mouse hover still opens the tooltip.
- **Stored language on first load** — with `dellorto_lang = 'de'` set
  before loading, `<html lang>` is `de` right away, without the language
  button.
- **Touch on row actions** — tapping a row action button (a `<button>`
  with a tooltip) runs its click, and no tooltip stays open.
- **No raw i18n keys** — no `view.`/`catalog.`/`svg.`/`carbType.`/`col.`/
  `btn.` key in the text, `title`, `aria-label`, `placeholder` or
  `data-tooltip` of the selector and the custom needle list; the PHBH ⓘ
  and the delete button carry the expected translated labels.

`test-browser/tuning.mjs` covers the fine tuning tab (service workers
blocked as above). The setup K27 C3 / 34 / DQ 264 / ND 50 / HD 128 is
entered through the calculator table like a user would; expected needles
match the regression values in `test/tuning.test.mjs`:

- **Tabs and history** — a direct load with `#tuning` opens the tab (empty
  state); tab clicks set `#tuning` / `#needles`, and `history.back()`
  (popstate) walks back through the tuning tab to the calculator.
- **Steps and cards** — loading K27 as reference, + in 1/8–1/4 gives
  K96 C5 in the status line and three cards (K96 · Clip 5, U7 · Clip 3
  with the "series change" tag, K97 · Clip 3), the first one pressed;
  + in 3/4–1 is disabled with its "HD-limited" reason visible in the row.
- **Undo semantics** — picking another card (tap anywhere on the card)
  adds no history entry: one "Step back" returns to the reference and
  hides the cards. A second step shows the K27 · Clip 4 card with "also:
  K33 · Clip 4"; "Reset to reference" disables both actions again.
- **Jets** — HD + turns the 3/4–1 delta from 0.0 % into +1.6 %, shows
  HD 129 in the status and hides the cards; the HD row is highlighted
  while ranges are HD-limited.
- **Apply** — "Save to free slot" writes slot 2 as "K96 C5" and leaves the
  reference slot alone; "Overwrite reference slot" writes slot 1 (name
  kept) and restarts tuning from it; Undo restores slot 1 and the tuning
  session; `dellorto_carb_type` is never written; "View in calculator"
  switches the view.
- **Language switch** — EN → DE → EN keeps status line, cards, the apply
  banner (translated) and the undo history.
- **Undo lifecycle** — after "Overwrite reference slot", the next tuning
  step closes the banner and keeps that step (Undo can't discard it).
- **Reference picker** — tapping the chip of the loaded, unchanged
  reference changes nothing; opening the manual form keeps the slot
  reference (chip pressed, overwrite still offered).
- **Manual reference** — with HD typed last and still focused, Load is
  already enabled and one click loads it.
- **Custom needle deleted** — custom needle A1 (ranked first for "richer in
  1/8–1/4") is on the cards: after adopting another card and deleting A1
  the stale cards are gone and the session stays; if A1 was current, the
  tab resets with a notice. No page errors either way.
- **Jet at its limit** — stepping the DQ needle jet to 274 disables + and
  shows "largest value reached" as text plus a cell tooltip.
- **Keyboard** — Enter steps and keeps focus; at a limit focus moves to
  the row label, so further Enters never step the other way.
- **Carb type** — switching the calculator to PHBH resets the tab (empty
  state, no reference chip pressed, "PHBH" shown).
- **Mobile 320×740 and 360×740** (`hasTouch`, `isMobile`, `tap()`) —
  tapping + steps; the reason next to the disabled + in 3/4–1 is visible;
  ± targets are ≥ 44 × 44 px; after scrolling to the bottom the sticky
  status line is still in the viewport, right below the tab bar; neither
  the page nor the tab bar overflows horizontally.

Set `CHROMIUM_PATH` to run these against a preinstalled Chromium when the
Playwright package and its downloaded browser versions don't match — an
installed Google Chrome works too (e.g. on Windows
`C:/Program Files/Google/Chrome/Application/chrome.exe`).

## Manual test checklist

The PWA items below are not automatable — a headless browser can't hold a real
install prompt, launch a real home screen icon, or exercise iOS's actual
"Add to Home Screen" sheet. Check these by hand before a release that
touches `sw.js`, `manifest.json`, `icons/`, or the install-button logic
in `js/app.js`.

### Android Chrome
- [ ] Visit the deployed app; `#btn-install` ("Install App") appears once
      Chrome's own installability check passes.
- [ ] Tap **Install App** → Chrome's native install dialog appears → confirm.
- [ ] App launches standalone (no address bar/tabs UI) from the home
      screen icon, using the maskable icon correctly cropped by the OS.
- [ ] Force-close the app, turn on airplane mode, relaunch from the home
      screen icon: the app still loads and is usable offline.
- [ ] With the app already installed, reload the app: `#btn-install`
      never reappears (`matchMedia('(display-mode: standalone)')` is
      `true` in this context).

### iOS Safari
- [ ] Visit the deployed app in **Safari** specifically (not Chrome/
      Firefox-on-iOS): `#btn-install` appears.
- [ ] Tap **Install App** → the instructional dialog appears with the
      share-icon glyph and the "tap Share, then Add to Home Screen" text
      (`install.iosDialogSteps`), not a native prompt.
- [ ] Follow the instructions manually: Safari's Share sheet → **Add to
      Home Screen** → confirm the name/icon shown → Add.
- [ ] Launch the app from the resulting home-screen icon: it opens
      standalone (`apple-mobile-web-app-capable`), with the correct
      `apple-touch-icon.png` (opaque, no transparency artifacts) and
      status bar style (`black-translucent`).
- [ ] Open the app in **Chrome on iOS** (CriOS): `#btn-install` must
      **not** appear (it's Safari-only, since only Safari can actually
      add to the home screen in a way this dialog's instructions match).
- [ ] With the app already added to the home screen, open it via Safari
      again (not the home-screen icon): confirm `#btn-install` does not
      reappear once `navigator.standalone` is checked — note this only
      holds when launched *from* the home-screen icon; Safari itself has
      no reliable "already installed" signal for a page loaded in a
      regular tab.

### Desktop Chrome/Edge
- [ ] Visit the deployed app: `#btn-install` appears in the header.
- [ ] Click **Install App** → the browser's native install dialog
      appears → confirm → app opens in its own window (no tabs/URL bar).
- [ ] Separately, reload the page and use the browser's own omnibox
      install icon (⊕ in the address bar) instead of the in-app button:
      same result, confirming the app doesn't depend on its own button
      to be installable.
- [ ] With the app installed as a window, launching it while offline
      still renders the full UI (table, both charts).
- [ ] Trigger an update (touch a precached file, run
      `npm run sync-sw-version` to refresh `JETTINGCALC_CACHE_VERSION`,
      redeploy, reopen the installed window): the update banner appears;
      "Update now" reloads into the new version.

### Fine tuning (real phone + desktop)

The browser tests cover the logic and the layout in Chromium; these need a
real device and a human eye.

- [ ] Phone (portrait, Android and iOS): the three tabs fit, "Fein-/
      abstimmung" breaks at the hyphen in DE, no label is cut off.
- [ ] Load a setup as reference, tap + a few times quickly: every tap
      steps once (no double-tap zoom, no missed taps), the status line
      stays visible at the top while scrolling, nothing scrolls on its own.
- [ ] A disabled + (e.g. 3/4–1 with a HD-limited setup) shows its reason as
      text; tapping next to it opens the tooltip.
- [ ] Manual reference on iOS: focusing a field does not zoom the page;
      the form is one column.
- [ ] Tap a badge on a suggestion card: its tooltip opens, the card is not
      picked. Tap elsewhere on the card: it is picked, "Step back" still
      needs only one tap to return.
- [ ] Apply to a free slot, then "View in calculator": the slot is there
      with the tuned values. Overwrite the reference slot, switch
      language, then Undo: the banner survived the language switch and
      Undo restores the slot.
- [ ] Dark mode: bars, badges, the highlighted HD row and the cards are
      readable.
- [ ] Desktop: keyboard only — Tab to a ± button, Enter steps and focus
      stays on the button; when it becomes disabled focus moves to the
      row's label, so further Enters do nothing (never the other
      direction).
