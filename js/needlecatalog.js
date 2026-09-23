// needlecatalog.js — Row building, filtering, sorting and value formatting
// for the needle catalog (geometry overview of every needle).
// Pure ES module: no DOM access, no localStorage, no import of storage.js
// or i18n.js. Only needledb.js (the read-only static data) is imported, so
// this module can be unit-tested with plain node:test. It contains no
// user-visible text — only keys, numbers and codes; column headings,
// filter labels etc. are resolved in the UI via t() and catalog.* keys.
// Copyright (C) 2014 GUE — GPL v2.0

import { NEEDLE_DB, VERIFIED_DEFAULT_CLIP_PREFIXES, getClipCount,
         getNeedleLength, getTaperCount } from './needledb.js';

// Catalog columns in display order. `key` doubles as the i18n suffix
// (t(`catalog.col.${key}`)) and as the sort key; `kind` drives
// formatCatalogValue(). The 'name' column maps to row.type, every other
// key is the row field of the same name.
export const CATALOG_COLUMNS = Object.freeze([
  { key: 'name',   kind: 'text' },
  { key: 'tapers', kind: 'int' },
  { key: 'A',      kind: 'diameter' },
  { key: 'B',      kind: 'diameter' },
  { key: 'C',      kind: 'position' },
  { key: 'D',      kind: 'diameter' },
  { key: 'E',      kind: 'position' },
  { key: 'F',      kind: 'position' },
  { key: 'clips',  kind: 'int' },
  { key: 'length', kind: 'position' },
].map(col => Object.freeze(col)));

// Typographic placeholder for a missing value — language-neutral.
export const CATALOG_EMPTY_VALUE = '–';

const GEOMETRY_FIELDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const COLUMN_KEYS = new Set(CATALOG_COLUMNS.map(col => col.key));

// Leading uppercase letters of a needle type ('K98' → 'K'), '' if none.
export function getNeedleSeries(type) {
  return String(type ?? '').match(/^[A-Z]+/)?.[0] ?? '';
}

// Natural order: series alphabetically, then the numeric part after the
// series (non-numeric remainders last), then plain string comparison as
// tiebreak — K9 < K10 < K98 < K98-mod < U1.
export function compareNeedleTypes(a, b) {
  const sa = getNeedleSeries(a);
  const sb = getNeedleSeries(b);
  if (sa !== sb) return sa < sb ? -1 : 1;

  const na = parseFloat(String(a).slice(sa.length));
  const nb = parseFloat(String(b).slice(sb.length));
  const aNaN = Number.isNaN(na);
  const bNaN = Number.isNaN(nb);
  if (aNaN !== bNaN) return aNaN ? 1 : -1;
  if (!aNaN && na !== nb) return na - nb;

  const ta = String(a);
  const tb = String(b);
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

function resolveClipsSource(type, isCustom) {
  if (isCustom) return 'custom';
  if (NEEDLE_DB[type]?.clips != null) return 'verified';
  if (VERIFIED_DEFAULT_CLIP_PREFIXES.includes(getNeedleSeries(type))) return 'verified';
  return 'default';
}

// One row per needle of the given carbType, sorted by compareNeedleTypes.
// `allNeedles` is the merged map from getAllNeedles() (custom overrides
// base), `customTypes` the types that came from the user's custom needles,
// `setups` the current setup slots (for usedBy). Inputs are not mutated.
export function buildCatalogRows({ allNeedles, carbType, customTypes = [], setups = [] }) {
  return Object.keys(allNeedles)
    .filter(type => allNeedles[type]?.carbType === carbType)
    .sort(compareNeedleTypes)
    .map(type => {
      const needle = allNeedles[type];
      const isCustom = customTypes.includes(type);
      const row = {
        type,
        series: getNeedleSeries(type),
        carbType: needle.carbType,
        tapers: getTaperCount(needle),
      };
      for (const field of GEOMETRY_FIELDS) row[field] = needle[field] ?? null;
      // Same resolution as resolveClipCount() in app.js.
      row.clips = needle.clips ?? getClipCount(type);
      row.clipsSource = resolveClipsSource(type, isCustom);
      row.length = getNeedleLength(needle, type);
      row.isCustom = isCustom;
      row.usedBy = setups
        .filter(s => s.needleType === type)
        .map(s => s.id)
        .sort((x, y) => x - y);
      return row;
    });
}

// Distinct non-empty series present in `rows`, alphabetically.
export function getSeriesList(rows) {
  return [...new Set(rows.map(r => r.series).filter(Boolean))].sort();
}

// Row counts per taper count, plus the total.
export function countByTaper(rows) {
  const counts = { all: rows.length, 1: 0, 2: 0, 3: 0 };
  for (const row of rows) {
    if (row.tapers in counts) counts[row.tapers] += 1;
  }
  return counts;
}

function normalizeQuery(query) {
  return String(query ?? '').replace(/\s+/g, '').toLowerCase();
}

// Returns a new array with the rows matching every given criterion.
// series: 'all' or an exact series; tapers: 0 = all, else 1 | 2 | 3;
// query: case-insensitive substring of the type, whitespace ignored;
// usedOnly: only needles referenced by at least one setup.
export function filterCatalogRows(rows, { series = 'all', tapers = 0, query = '', usedOnly = false } = {}) {
  const q = normalizeQuery(query);
  const taperFilter = Number(tapers) || 0;
  return rows.filter(row =>
    (series === 'all' || row.series === series)
    && (taperFilter === 0 || row.tapers === taperFilter)
    && (q === '' || row.type.toLowerCase().includes(q))
    && (!usedOnly || row.usedBy.length > 0));
}

// Returns a new array sorted by a CATALOG_COLUMNS key (unknown → 'name').
// 'name' uses compareNeedleTypes, every other key compares numerically.
// null values always go last regardless of `dir`; ties fall back to
// compareNeedleTypes ascending.
export function sortCatalogRows(rows, { key = 'name', dir = 'asc' } = {}) {
  const sortKey = COLUMN_KEYS.has(key) ? key : 'name';
  const sign = dir === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    if (sortKey === 'name') return sign * compareNeedleTypes(a.type, b.type);

    const va = a[sortKey];
    const vb = b[sortKey];
    const aNull = va == null;
    const bNull = vb == null;
    if (aNull !== bNull) return aNull ? 1 : -1;
    if (!aNull && va !== vb) return sign * (va - vb);
    return compareNeedleTypes(a.type, b.type);
  });
}

// toFixed(maxDigits), then trailing zeros dropped down to minDigits.
function toFixedRange(value, minDigits, maxDigits) {
  let str = Number(value).toFixed(maxDigits);
  for (let digits = maxDigits; digits > minDigits && str.endsWith('0'); digits--) {
    str = str.slice(0, -1);
  }
  return str;
}

// Display string for a catalog cell. The decimal separator is always '.',
// in both languages, consistent with the rest of the app (toFixed in
// app.js) — no locale formatting here.
// diameter: 2–3 decimals (2.5 → '2.50', 2.108 → '2.108')
// position: 1–2 decimals (37 → '37.0', 32.4 → '32.4', 29.46 → '29.46') —
//           a second decimal is needed for several X-needle C values, so
//           a fixed single decimal would round real data.
export function formatCatalogValue(value, kind) {
  if (value == null) return CATALOG_EMPTY_VALUE;
  if (kind === 'diameter') return toFixedRange(value, 2, 3);
  if (kind === 'position') return toFixedRange(value, 1, 2);
  return String(value);
}
