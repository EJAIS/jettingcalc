# Vendored dependencies

This directory holds third-party runtime dependencies that are bundled
locally so the app has zero external runtime dependencies (no CDN calls,
consistent with the project's no-external-resources policy).

## Chart.js

- **File:** `chart.umd.min.js`
- **Pinned version:** 4.5.1
- **Source:** https://registry.npmjs.org/chart.js/-/chart.js-4.5.1.tgz
  (`dist/chart.umd.min.js` from the published npm package — the same file
  served by `https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`
  at the time it was vendored)
- **Integrity (sha512, npm registry):**
  `sha512-GIjfiT9dbmHRiYi6Nl2yFCq7kkwdkp1W/lp2J99rX0yo9tgJGn3lKQATztIjb5tVtevcBtIdICNWqlq5+E8/Pw==`
- **License:** MIT — Copyright (c) 2014-2024 Chart.js Contributors.
  Full license text: https://github.com/chartjs/Chart.js/blob/master/LICENSE.md

Chart.js is released under the MIT License, which is compatible with this
project's own GPL-2.0 license (MIT-licensed code may be included in a
GPL-2.0 work).

### Updating

1. Look up the target version on https://registry.npmjs.org/chart.js
2. Download and verify the tarball's `dist.integrity`/`dist.shasum` against
   the npm registry metadata before extracting.
3. Copy `dist/chart.umd.min.js` from the tarball into this directory,
   replacing the existing file.
4. Update the version, source, and integrity hash noted above.
