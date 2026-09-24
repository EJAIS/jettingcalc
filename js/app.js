// app.js — UI logic, event handling
// Copyright (C) 2014 GUE — GPL v2.0

import { loadSetups, saveSetups, loadCustomNeedles, saveCustomNeedles, getAllNeedles, loadCarbType, saveCarbType } from './storage.js';
import { calcSetup } from './calc.js';
import { calcCutaway, snapToSlide, isRoundSlide2Stroke } from './cutaway.js';
import { renderCharts, openChartModal, closeChartModal, getColors } from './charts.js';
import { NEEDLE_DB, CARB_TYPES, CARB_BORE_SIZES, VHSX_BORE_GROUPS, ATOMIZER_SIZES, getClipCount,
         getCustomNeedleLength, migrateCustomNeedles } from './needledb.js';
import { t, getLang, setLang, applyTranslations } from './i18n.js';
import { encodeShare, decodeShare, hasShareParams, stateKey, isSlotEmpty, isSlotDataEmpty, shareParamKeys } from './share.js';
import { CATALOG_COLUMNS, buildCatalogRows, getSeriesList, countByTaper, filterCatalogRows,
         sortCatalogRows, formatCatalogValue } from './needlecatalog.js';

let setups   = loadSetups();
let carbType = loadCarbType();

// In-memory only (never persisted): tracks a pending "Undo" for a share
// link applied at page load. { snapshot: {setups, carbType} | null, importedKey }
let importUndo = null;

// Needle catalog view state — in-memory only (never persisted). carbType
// null means "follow the calculator's carbType"; picking a type in the
// catalog only changes this state, never the global carbType or setups.
const catalogState = {
  carbType: null, series: 'all', tapers: 0,
  query: '', usedOnly: false,
  sortKey: 'name', sortDir: 'asc',
  legendOpen: false,
};

// Currently shown view: 'calc' | 'needles'
let currentView = 'calc';

// ── Install App (PWA) ────────────────────────────────────────────────────────
//
// Chromium/Android/Desktop: the browser fires 'beforeinstallprompt' once it
// decides the app is installable. We stash that event (it also serves as
// our native install trigger) and reveal #btn-install. Registered here at
// module scope — not inside DOMContentLoaded — so an event fired very early
// (before DOMContentLoaded) isn't missed; by the time this module (a
// deferred <script type="module">) runs, the DOM is already parsed, so
// touching #btn-install from here is safe too.
//
// iOS Safari never fires 'beforeinstallprompt' at all, so it gets its own
// detection + a purely instructional dialog instead (see
// maybeShowIosInstallButton(), called once from DOMContentLoaded).
//
// installPromptMode tells the shared #btn-install click handler which of
// the two behaviors to run.
let deferredInstallPrompt = null;
let installPromptMode = null; // 'native' | 'ios-instructions'

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function showInstallButton() {
  const btn = document.getElementById('btn-install');
  if (btn) btn.hidden = false;
}

function hideInstallButton() {
  const btn = document.getElementById('btn-install');
  if (btn) btn.hidden = true;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  if (isAppInstalled()) return; // shouldn't fire in this case, but don't trust it
  deferredInstallPrompt = e;
  installPromptMode = 'native';
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallButton();
});

// iOS UA, actually Safari (not Chrome/Firefox/Edge-on-iOS, which are all
// WebKit under the hood but report their own UA substring), and not
// already running from the home screen.
function isIosSafari() {
  const ua = navigator.userAgent;
  if (!/iPad|iPhone|iPod/.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  return navigator.standalone !== true;
}

function maybeShowIosInstallButton() {
  if (isAppInstalled() || !isIosSafari()) return;
  installPromptMode = 'ios-instructions';
  showInstallButton();
}

async function handleInstallButtonClick() {
  if (installPromptMode === 'ios-instructions') {
    document.getElementById('install-dialog')?.showModal();
    return;
  }
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice; // outcome ('accepted' | 'dismissed') doesn't change what we do next
  deferredInstallPrompt = null;
  hideInstallButton();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function needleSort(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  return parseInt(a.slice(1)) - parseInt(b.slice(1));
}

function getNeedlesForCarbType(ct) {
  return Object.entries(getAllNeedles())
    .filter(([, needle]) => needle.carbType === ct)
    .map(([key]) => key)
    .sort(needleSort);
}

function buildNeedleOptions(selectedType) {
  const keys = getNeedlesForCarbType(carbType);
  const customTypes = loadCustomNeedles()
    .filter(n => n.carbType === carbType)
    .map(n => n.type);
  return `<option value="">${t('setup.select')}</option>` +
    keys.map(k => {
      const esc = escapeHtml(k);
      return `<option value="${esc}"${k === selectedType ? ' selected' : ''}${customTypes.includes(k) ? ' class="custom-needle"' : ''}>${esc}${customTypes.includes(k) ? ' *' : ''}</option>`;
    }).join('');
}

function buildCarbSizeOptions(selectedSize) {
  const opts = [`<option value="">${t('setup.select')}</option>`];
  if (carbType === 'VHSx') {
    for (const group of VHSX_BORE_GROUPS) {
      opts.push(`<optgroup label="${escapeHtml(group.label)}">`);
      opts.push(...group.sizes.map(v =>
        `<option value="${v}"${String(v) === String(selectedSize) ? ' selected' : ''}>${v}</option>`));
      opts.push('</optgroup>');
    }
  } else {
    const sizes = CARB_BORE_SIZES[carbType] ?? [];
    opts.push(...sizes.map(v =>
      `<option value="${v}"${String(v) === String(selectedSize) ? ' selected' : ''}>${v}</option>`));
  }
  return opts.join('');
}

function buildNeedleJetOptions(jetType, selectedValue) {
  const sizes = jetType ? (ATOMIZER_SIZES[jetType] ?? []) : [];
  return `<option value="">${t('setup.select')}</option>` +
    sizes.map(v => `<option value="${v}"${String(v) === String(selectedValue) ? ' selected' : ''}>${v}</option>`).join('');
}

// Single source of truth for clip-position count, shared by every caller
// that needs it (table dropdown, needleType-change clamp) so the
// custom-needle-vs-official fallback logic only lives in one place.
// `allNeedles` (from getAllNeedles()) already merges each custom needle's
// own `clips` field over NEEDLE_DB — see storage.js.
function resolveClipCount(needleType, allNeedles) {
  return allNeedles[needleType]?.clips ?? getClipCount(needleType);
}

function buildClipPosOptions(needleType, selectedValue, allNeedles) {
  const count = needleType ? resolveClipCount(needleType, allNeedles) : 0;
  const positions = Array.from({ length: count }, (_, i) => i + 1);
  return `<option value="">${t('setup.select')}</option>` +
    positions.map(p => `<option value="${p}"${String(p) === String(selectedValue) ? ' selected' : ''}>${p}</option>`).join('');
}

function showNotice(msg) {
  const el = document.getElementById('app-notice');
  if (!el) return;
  el.textContent = msg;
  el.removeAttribute('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.setAttribute('hidden', ''), 5000);
}

// ── Table rendering ───────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('setup-tbody');
  if (!tbody) return;

  const allNeedles     = getAllNeedles();
  const validAtomizers = CARB_TYPES[carbType].atomizers;

  tbody.innerHTML = setups.map(s => {
    const result = s.needleType ? calcSetup(s, allNeedles) : null;
    const maxHD  = result ? Math.round(result.maxHD) : '—';

    let cutawayCell = '—';
    const needle = allNeedles[s.needleType];
    if (isRoundSlide2Stroke(carbType) && needle && s.carbSize && s.hd && s.needleJet) {
      const ca    = calcCutaway(s.carbSize, s.hd, s.needleJet, needle.A);
      const slide = ca.cutawayClamped != null ? snapToSlide(ca.cutawayClamped, carbType) : '—';
      if (ca.ratioOk) {
        cutawayCell = `<span class="cutaway-col-value">${slide}</span>`;
      } else {
        const tipText = t('cutaway.colWarning').replace('{ratio}', ca.ratio.toFixed(2)).replace('{section}', t('section.calcResults'));
        cutawayCell = `<span class="cutaway-col-value">${slide}</span><span class="cutaway-col-warn" data-tooltip="${tipText}" role="button" tabindex="0" aria-label="${tipText}">⚠</span>`;
      }
    }

    return `
    <tr data-row-id="${s.id}">
      <td>
        <input type="text" class="cell-input" data-id="${s.id}" data-field="name"
               value="${escapeHtml(s.name)}" title="Setup name">
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="needleType">
          ${buildNeedleOptions(s.needleType)}
        </select>
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="clipPos">
          ${buildClipPosOptions(s.needleType, s.clipPos, allNeedles)}
        </select>
      </td>
      <td class="carbsize-cell">
        <select class="cell-input" data-id="${s.id}" data-field="carbSize">
          ${buildCarbSizeOptions(s.carbSize)}
        </select>
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="jetType"
                title="${t('col.jetType.title')}">
          <option value="">—</option>
          ${validAtomizers.map(a => `<option value="${a}"${s.jetType === a ? ' selected' : ''}>${a}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="needleJet">
          ${buildNeedleJetOptions(s.jetType, s.needleJet)}
        </select>
      </td>
      <td class="maxhd-cell">${maxHD}</td>
      <td class="cutaway-col-cell">${cutawayCell}</td>
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="nd"
               value="${s.nd ?? ''}" min="0" max="200" placeholder="ND">
      </td>
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="hd"
               value="${s.hd ?? ''}" min="0" max="300" placeholder="HD">
      </td>
      <td class="row-actions">
        <button type="button" class="btn-icon" data-action="duplicate-row"
                data-id="${s.id}" data-tooltip="${t('action.duplicateRow')}"
                aria-label="${t('action.duplicateRow')}"
                ${!s.needleType ? 'disabled' : ''}>⧉</button>
        <button type="button" class="btn-icon btn-icon-danger" data-action="reset-row"
                data-id="${s.id}" data-tooltip="${t('action.resetRow')}"
                aria-label="${t('action.resetRow')}"
                ${!s.needleType ? 'disabled' : ''}>↺</button>
      </td>
    </tr>`;
  }).join('');
}

function renderCalcResults() {
  const container = document.getElementById('calc-results-body');
  if (!container) return;

  const allNeedles = getAllNeedles();
  const activeSetups = setups.filter(s => s.needleType);

  if (activeSetups.length === 0) {
    container.innerHTML = `<p class="cr-empty">${t('msg.noActiveSetups')}</p>`;
    return;
  }

  container.innerHTML = activeSetups.map(s => {
    const result = calcSetup(s, allNeedles);
    if (!result) return '';
    const color = getColors()[s.id - 1];
    const rows = result.curve.map(p => {
      const extrap = p.tp > 1.0 + 1e-9;
      return `
      <tr${extrap ? ' class="cr-row-extrap"' : ''}>
        <td>${Math.round(p.tp * 100)}%${extrap ? '*' : ''}</td>
        <td>${p.pos.toFixed(2)}</td>
        <td>${p.diam.toFixed(3)}</td>
        <td>${Math.round(p.hdEquiv)}</td>
        <td>${Math.round(p.overall)}</td>
      </tr>`;
    }).join('');

    let cutawayHTML = '';
    const needle = allNeedles[s.needleType];
    if (isRoundSlide2Stroke(carbType) && needle && s.carbSize && s.hd && s.needleJet) {
      const ca = calcCutaway(s.carbSize, s.hd, s.needleJet, needle.A);
      const valueHTML = ca.ratioOk
        ? `<span class="cutaway-value">~${ca.cutawayClamped.toFixed(1)} mm
             <span class="cutaway-slide">(${t('cutaway.closest')}: <b>${snapToSlide(ca.cutawayClamped, carbType)}</b>)</span>
           </span>`
        : `<span class="cutaway-warning">${t('cutaway.warning')}</span>`;
      cutawayHTML = `
        <div class="cutaway-section">
          <div class="cutaway-row">
            <span class="cutaway-label">${t('cutaway.label')}</span>
            ${valueHTML}
            <span class="cutaway-info" data-tooltip="${t('cutaway.disclaimer')}" role="button" tabindex="0" aria-label="${t('cutaway.disclaimer')}">ℹ</span>
          </div>
          <div class="cutaway-row">
            <span class="cutaway-label">${t('cutaway.ratio')}</span>
            <span class="cutaway-value${ca.ratioOk ? '' : ' cutaway-ratio-bad'}">
              ${ca.ratio.toFixed(2)} <span class="cutaway-target">(${t('cutaway.target')})</span>
            </span>
          </div>
        </div>`;
    }

    return `
      <div class="cr-table-wrap">
        <table class="cr-table">
          <caption style="color:${color}">${escapeHtml(s.name)}</caption>
          <thead>
            <tr>
              <th>${t('col.throttle')}</th>
              <th>${t('col.needlePos')}</th>
              <th>${t('col.needleDiam')}</th>
              <th>${t('col.hdEquiv')}</th>
              <th>${t('col.overall')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="cr-extrap-note">${t('calc.extrapolationNote')}</p>
        ${cutawayHTML}
      </div>`;
  }).join('');
}

// Beta-banner translation key by carb type — carb types not listed here show no banner.
const BETA_BANNER_KEY = {
  PHBH: 'carbType.phbhBetaBanner',
  PHBL: 'carbType.phblBetaBanner',
};

function updateUI() {
  document.querySelectorAll('input[name="carbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });
  const banner = document.getElementById('carb-beta-banner');
  if (banner) {
    const key = BETA_BANNER_KEY[carbType];
    banner.hidden = !key;
    if (key) banner.textContent = t(key);
  }
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) shareBtn.disabled = !setups.some(s => s.needleType);
  // Central check so the import banner survives a language toggle (which
  // also calls updateUI() but never changes carbType/setups) and only
  // disappears once the state actually diverges from what was imported.
  if (importUndo && stateKey({ carbType, setups }) !== importUndo.importedKey) {
    hideImportBanner();
  }
  renderTable();
  renderCharts(setups, getAllNeedles());
  renderCalcResults();
  renderCrossSection();
  // Covers setup edits, custom-needle save/delete and language changes.
  if (currentView === 'needles') renderNeedleCatalog();
}

// ── Views (calculator / needle catalog) ─────────────────────────────────────

const VIEW_PANELS = { calc: 'view-calc', needles: 'view-needles' };
const VIEW_TABS   = { calc: 'tab-calc',  needles: 'tab-catalog' };
const CATALOG_HASH = '#needles';

function hashToView() {
  return location.hash === CATALOG_HASH ? 'needles' : 'calc';
}

function showView(view, { push = true } = {}) {
  if (!VIEW_PANELS[view]) view = 'calc';
  // Initial call on page load (same view, no push) keeps the browser's
  // scroll restoration; every actual switch starts at the top.
  const changed = view !== currentView;
  currentView = view;
  for (const [v, panelId] of Object.entries(VIEW_PANELS)) {
    const panel = document.getElementById(panelId);
    if (panel) panel.hidden = v !== view;
    const tab = document.getElementById(VIEW_TABS[v]);
    if (tab) {
      tab.setAttribute('aria-selected', String(v === view));
      tab.tabIndex = v === view ? 0 : -1;
    }
  }
  if (push) {
    // Keep pathname + search (e.g. unrelated query params), only swap the hash.
    const url = location.pathname + location.search + (view === 'needles' ? CATALOG_HASH : '');
    if (url !== location.pathname + location.search + location.hash) history.pushState(null, '', url);
  }
  if (changed || push) window.scrollTo(0, 0);
  if (view === 'needles') renderNeedleCatalog();
}

function handleViewTabKeydown(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const views = Object.keys(VIEW_TABS);
  const idx = views.indexOf(currentView);
  const next = views[(idx + (e.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length];
  e.preventDefault();
  showView(next);
  document.getElementById(VIEW_TABS[next])?.focus();
}

// ── Needle schematic ────────────────────────────────────────────────────────

// Clones the shared needle schematic (<template id="tpl-needle-schematic">)
// into `container`. Every id in the copy gets a `-${suffix}` suffix and all
// url(#id) / href="#id" references inside it are rewritten to match: with
// two copies sharing id="ndl-arrow", both would resolve to the first one's
// marker, which some browsers don't render while it sits in a collapsed
// <details>. Returns the mounted <svg> (or null if nothing was mounted).
function mountNeedleSchematic(container, suffix) {
  const tpl = document.getElementById('tpl-needle-schematic');
  if (!container || !tpl) return null;
  const clone = tpl.content.cloneNode(true);

  const renamed = new Map();
  clone.querySelectorAll('[id]').forEach(el => {
    renamed.set(el.id, `${el.id}-${suffix}`);
    el.id = `${el.id}-${suffix}`;
  });
  const rewrite = value => value
    .replace(/url\(#([^)]+)\)/g, (m, id) => renamed.has(id) ? `url(#${renamed.get(id)})` : m)
    .replace(/^#(.+)$/, (m, id) => renamed.has(id) ? `#${renamed.get(id)}` : m);
  clone.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (!attr.value.includes('#')) continue;
      const updated = rewrite(attr.value);
      if (updated !== attr.value) el.setAttribute(attr.name, updated);
    }
  });

  container.replaceChildren(clone);
  return container.querySelector('svg');
}

// ── Needle catalog ──────────────────────────────────────────────────────────

function catalogCarbType() {
  return catalogState.carbType ?? carbType;
}

// Replaces only the first occurrence of `placeholder` — via a replacer
// function so `$&`/`$1` in user-provided text (setup names) stay literal.
function fillPlaceholder(template, placeholder, value) {
  return template.replace(placeholder, () => String(value));
}

// All rows of the active catalog carbType, before any filter.
function buildActiveCatalogRows() {
  return buildCatalogRows({
    allNeedles:  getAllNeedles(),
    carbType:    catalogCarbType(),
    customTypes: loadCustomNeedles().map(n => n.type),
    setups,
  });
}

function renderNeedleCatalog() {
  renderCatalogLegend();
  renderCatalogControls();
  renderCatalogTable();
}

// Dimension key (needle schematic) below the filter bar: visibility, plus
// the toggle's label/aria-expanded — re-run on every catalog render so the
// label follows language changes.
function renderCatalogLegend() {
  const open = catalogState.legendOpen;
  const legend = document.getElementById('catalog-legend');
  if (legend) legend.hidden = !open;
  const btn = document.getElementById('catalog-legend-toggle');
  if (btn) {
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = t(open ? 'catalog.legend.hide' : 'catalog.legend.show');
  }
}

// Re-rendering replaces the focused button; this puts focus back on its
// replacement (matched by the same data-* attribute) so keyboard users
// don't get thrown back to <body> on every filter click.
function withPreservedFocus(container, selectorAttrs, render) {
  const active = document.activeElement;
  const attr = active && container.contains(active)
    ? selectorAttrs.find(a => active.hasAttribute(a))
    : null;
  const value = attr ? active.getAttribute(attr) : null;
  render();
  if (attr) container.querySelector(`[${attr}="${CSS.escape(value)}"]`)?.focus();
}

const CATALOG_CONTROL_ATTRS = ['data-catalog-carb', 'data-catalog-series', 'data-catalog-tapers', 'data-catalog-used'];

function renderCatalogControls() {
  const container = document.getElementById('catalog-controls');
  if (!container) return;

  const activeType = catalogCarbType();
  const rows = buildActiveCatalogRows();
  const seriesList = getSeriesList(rows);
  // Taper counts reflect the series choice only (not taper/search filter).
  const counts = countByTaper(filterCatalogRows(rows, { series: catalogState.series }));
  const pressed = on => `aria-pressed="${on ? 'true' : 'false'}"`;

  const carbButtons = Object.keys(CARB_TYPES).map(ct => {
    const badge = BETA_BANNER_KEY[ct]
      ? ` <span class="beta-badge">${escapeHtml(t('carbType.betaBadge'))}</span>` : '';
    return `<button type="button" class="catalog-carb${BETA_BANNER_KEY[ct] ? ' beta' : ''}" data-catalog-carb="${escapeHtml(ct)}" ${pressed(ct === activeType)}>${escapeHtml(ct)}${badge}</button>`;
  }).join('');

  const seriesChips = seriesList.length > 1
    ? [['all', t('catalog.filter.all')],
       ...seriesList.map(sr => [sr, fillPlaceholder(t('catalog.filter.series'), '{s}', sr)])]
        .map(([value, label]) => `<button type="button" class="chip" data-catalog-series="${escapeHtml(value)}" ${pressed(catalogState.series === value)}>${escapeHtml(label)}</button>`)
        .join('')
    : '';

  const taperChips = [0, 1, 2, 3].map(n => {
    const label = n === 0 ? t('catalog.filter.all') : fillPlaceholder(t('catalog.filter.tapers'), '{n}', n);
    const count = n === 0 ? counts.all : counts[n];
    const isActive = catalogState.tapers === n;
    return `<button type="button" class="chip" data-catalog-tapers="${n}" ${pressed(isActive)}${count === 0 && !isActive ? ' disabled' : ''}>${escapeHtml(label)} <span class="chip-count">${count}</span></button>`;
  }).join('');

  withPreservedFocus(container, CATALOG_CONTROL_ATTRS, () => {
    container.innerHTML = `
      <div class="catalog-carb-group" role="group" aria-labelledby="catalog-carb-label">
        <span id="catalog-carb-label" class="catalog-group-label">${escapeHtml(t('carbType.label'))}</span>
        <div class="catalog-carb-buttons">${carbButtons}</div>
      </div>
      <div class="catalog-chips" role="group" aria-label="${escapeHtml(t('catalog.filter.label'))}">
        ${seriesChips ? `<div class="chip-group">${seriesChips}</div>` : ''}
        <div class="chip-group">${taperChips}</div>
      </div>
      <button type="button" class="chip catalog-used-toggle" data-catalog-used="1" ${pressed(catalogState.usedOnly)}>${escapeHtml(t('catalog.usedOnly'))}</button>`;
  });
}

function catalogSortIndicator(key) {
  if (catalogState.sortKey !== key) return '↕';
  return catalogState.sortDir === 'asc' ? '▲' : '▼';
}

function renderCatalogTable() {
  const table = document.getElementById('catalog-table');
  if (!table) return;

  const allRows = buildActiveCatalogRows();
  const rows = sortCatalogRows(
    filterCatalogRows(allRows, catalogState),
    { key: catalogState.sortKey, dir: catalogState.sortDir },
  );
  const colors = getColors();
  const setupName = id => setups.find(s => s.id === id)?.name ?? `#${id}`;

  const headCells = CATALOG_COLUMNS.map(({ key, kind }) => {
    const label = t(`catalog.col.${key}`);
    const isSorted = catalogState.sortKey === key;
    const ariaSort = isSorted ? (catalogState.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="${kind === 'text' ? '' : 'num'}${isSorted ? ' sorted' : ''}" aria-sort="${ariaSort}">`
      + `<button type="button" class="catalog-sort" data-catalog-sort="${escapeHtml(key)}" aria-label="${escapeHtml(fillPlaceholder(t('catalog.sortBy'), '{col}', label))}">`
      + `${escapeHtml(label)}<span class="catalog-sort-arrow" aria-hidden="true">${catalogSortIndicator(key)}</span>`
      + `</button></th>`;
  }).join('');

  const bodyRows = rows.map(row => {
    const cells = CATALOG_COLUMNS.map(({ key, kind }) => {
      if (key === 'name') {
        const badge = row.isCustom
          ? ` <span class="catalog-badge">${escapeHtml(t('catalog.badge.custom'))}</span>` : '';
        let dots = '';
        if (row.usedBy.length > 0) {
          const label = fillPlaceholder(t('catalog.usedBy'), '{names}', row.usedBy.map(setupName).join(', '));
          dots = ` <span class="catalog-used" role="img" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">`
            + row.usedBy.map(id => `<span class="catalog-dot" style="background:${escapeHtml(colors[id - 1] ?? 'var(--text-muted)')}"></span>`).join('')
            + `</span>`;
        }
        return `<th scope="row" class="catalog-name"><strong>${escapeHtml(row.type)}</strong>${badge}${dots}</th>`;
      }
      if (key === 'clips' && row.clipsSource === 'default') {
        const tip = escapeHtml(t('catalog.clipsDefault.tooltip'));
        return `<td class="num"><span class="catalog-unverified" title="${tip}" aria-label="${escapeHtml(row.clips)} — ${tip}">${escapeHtml(row.clips)}*</span></td>`;
      }
      return `<td class="num">${escapeHtml(formatCatalogValue(row[key], kind))}</td>`;
    }).join('');
    return `<tr data-type="${escapeHtml(row.type)}">${cells}</tr>`;
  }).join('');

  withPreservedFocus(table, ['data-catalog-sort'], () => {
    table.innerHTML = `<thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody>`;
  });

  const countEl = document.getElementById('catalog-count');
  if (countEl) {
    countEl.textContent = fillPlaceholder(
      fillPlaceholder(t('catalog.count'), '{n}', rows.length), '{total}', allRows.length);
  }
  const emptyEl = document.getElementById('catalog-empty');
  if (emptyEl) emptyEl.hidden = rows.length > 0;
}

function handleCatalogControlClick(e) {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  if (btn.dataset.catalogCarb) {
    catalogState.carbType = btn.dataset.catalogCarb;
    catalogState.series = 'all';
    catalogState.tapers = 0;
  } else if (btn.dataset.catalogSeries) {
    catalogState.series = btn.dataset.catalogSeries;
  } else if (btn.dataset.catalogTapers) {
    catalogState.tapers = Number(btn.dataset.catalogTapers);
  } else if (btn.dataset.catalogUsed) {
    catalogState.usedOnly = !catalogState.usedOnly;
  } else {
    return;
  }
  renderNeedleCatalog();
}

function handleCatalogSortClick(e) {
  const key = e.target.closest('[data-catalog-sort]')?.dataset.catalogSort;
  if (!key) return;
  if (catalogState.sortKey === key) {
    catalogState.sortDir = catalogState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    catalogState.sortKey = key;
    catalogState.sortDir = 'asc';
  }
  renderCatalogTable();
}

// ── Carb type change ──────────────────────────────────────────────────────────

function handleCarbTypeChange(newCarbType) {
  carbType = newCarbType;
  saveCarbType(carbType);
  // The catalog follows the calculator again after an explicit change here.
  catalogState.carbType = null;
  catalogState.series = 'all';

  const allNeedles     = getAllNeedles();
  const validAtomizers = CARB_TYPES[carbType].atomizers;

  let resetCount = 0;
  setups.forEach(s => {
    let changed = false;
    if (s.needleType && allNeedles[s.needleType]?.carbType !== carbType) {
      s.needleType = null;
      s.clipPos = null; // clip count is needle-specific; stale value would be meaningless
      changed = true;
    }
    if (s.jetType && !validAtomizers.includes(s.jetType)) {
      s.jetType = null;
      changed = true;
    }
    if (s.carbSize != null && !CARB_BORE_SIZES[carbType]?.includes(s.carbSize)) {
      s.carbSize = null;
      changed = true;
    }
    if (changed) resetCount++;
  });

  // Auto-select the atomizer when only one option exists for this carb type
  if (validAtomizers.length === 1) {
    setups.forEach(s => { if (s.jetType === null) s.jetType = validAtomizers[0]; });
  }

  saveSetups(setups);
  if (resetCount > 0) showNotice(t('msg.setupsReset').replace('{n}', resetCount));
  updateUI();
}

// ── Field change handler ──────────────────────────────────────────────────────

// nd/hd are free-typed <input type="number" min max"> cells (unlike
// clipPos/carbSize/needleJet, which are <select> dropdowns and so are
// already constrained to valid options) — browsers don't clamp typed values
// to min/max on their own, so out-of-range values must be clamped here.
// Bounds match the HTML attributes in index.html and share.js's ND_MAX/HD_MAX.
const NUM_FIELD_BOUNDS = { nd: [0, 200], hd: [0, 300] };

function handleFieldChange(id, field, value) {
  const idx = setups.findIndex(s => s.id === id);
  if (idx === -1) return;

  const numFields = ['clipPos', 'carbSize', 'needleJet', 'nd', 'hd'];
  if (numFields.includes(field)) {
    let num = value === '' ? null : parseFloat(value);
    const bounds = NUM_FIELD_BOUNDS[field];
    if (num != null && bounds) num = Math.min(bounds[1], Math.max(bounds[0], num));
    setups[idx][field] = num;
  } else {
    setups[idx][field] = value === '' ? null : value;
  }

  if (field === 'jetType') {
    const validSizes = value ? (ATOMIZER_SIZES[value] ?? []) : [];
    if (setups[idx].needleJet != null && !validSizes.includes(setups[idx].needleJet)) {
      setups[idx].needleJet = null;
    }
  }

  if (field === 'needleType') {
    const maxClips = value ? resolveClipCount(value, getAllNeedles()) : 0;
    if (setups[idx].clipPos != null && setups[idx].clipPos > maxClips) {
      setups[idx].clipPos = null;
    }
  }

  saveSetups(setups);
  updateUI();
}

function resetRow(id) {
  const idx = setups.findIndex(s => s.id === id);
  if (idx === -1) return;
  if (!confirm(t('confirm.resetRow').replace('{name}', setups[idx].name))) return;
  setups[idx] = {
    id, name: `#${id}`,
    needleType: null, clipPos: null, carbSize: null,
    needleJet: null, jetType: null, nd: null, hd: null,
  };
  saveSetups(setups);
  updateUI();
}

function duplicateRow(id) {
  const source = setups.find(s => s.id === id);
  if (!source || !source.needleType) return;

  const target = setups.find(s => s.id !== id && s.needleType == null);
  if (!target) {
    showNotice(t('msg.noEmptyRowToDuplicate'));
    return;
  }

  const targetIdx = setups.findIndex(s => s.id === target.id);
  setups[targetIdx] = {
    ...structuredClone(source),
    id: target.id,
    name: source.name + t('duplicate.suffix'),
  };
  saveSetups(setups);
  updateUI();
  flashRow(target.id);
}

function flashRow(id) {
  const row = document.querySelector(`#setup-tbody tr[data-row-id="${id}"]`);
  if (!row) return;
  row.classList.add('row-flash');
  setTimeout(() => row.classList.remove('row-flash'), 1200);
}

// ── Share dialog ─────────────────────────────────────────────────────────────

function shareBaseUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function openShareDialog() {
  const dialog  = document.getElementById('share-dialog');
  const linkRow = document.getElementById('share-link-row');
  const urlInput = document.getElementById('share-url');
  const errorEl = document.getElementById('share-error');
  const copyBtn = document.getElementById('btn-share-copy');
  if (!dialog) return;

  clearTimeout(copyBtn._resetTimer);
  copyBtn.textContent = t('btn.copyLink');

  const result = encodeShare({ carbType, setups }, { baseUrl: shareBaseUrl() });

  if (result.ok) {
    linkRow.hidden = false;
    errorEl.hidden = true;
    errorEl.textContent = '';
    urlInput.value = result.url;
  } else {
    linkRow.hidden = true;
    errorEl.hidden = false;
    if (result.reason === 'customNeedle') {
      const setupNames = result.details.map(d => d.name).join(', ');
      const needleTypes = result.details.map(d => d.needleType).join(', ');
      errorEl.textContent = t('err.share.customNeedle')
        .replace('{setups}', setupNames)
        .replace('{needles}', needleTypes);
    } else {
      errorEl.textContent = t('err.share.noActiveSetups');
    }
  }

  dialog.showModal();
  if (result.ok) {
    urlInput.focus();
    urlInput.select();
  }
}

async function copyShareLink() {
  const urlInput = document.getElementById('share-url');
  const copyBtn  = document.getElementById('btn-share-copy');
  if (!urlInput?.value) return;

  let copied = false;
  try {
    await navigator.clipboard.writeText(urlInput.value);
    copied = true;
  } catch {
    urlInput.focus();
    urlInput.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
  }

  if (copied) {
    copyBtn.textContent = t('btn.copied');
    clearTimeout(copyBtn._resetTimer);
    copyBtn._resetTimer = setTimeout(() => { copyBtn.textContent = t('btn.copyLink'); }, 2000);
  }
}

// ── Share import (applied once, at page load) ───────────────────────────────

// Removes only the share-link params from the current URL (not any other
// query params or hash that might happen to coexist with them) and replaces
// the history entry so the decoded state is never re-applied on reload.
function scrubShareParamsFromUrl() {
  const url = new URL(location.href);
  for (const key of shareParamKeys()) url.searchParams.delete(key);
  const qs = url.searchParams.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
}

// Reads a share link from the URL (if any) and applies it. Always scrubs
// the share params from the URL afterwards, whatever the outcome.
//
// `offlineStale` comes from isShareLinkPossiblyStale() (called before this,
// in the DOMContentLoaded sequence, only when hasShareParams() is true): it
// means the app was fully offline when the link was opened, so whatever
// needledb.js this decodes against might not be the newest one the link
// was created with. When true, msg.shareOfflineStaleWarning is appended
// alongside whatever other notice this call already shows — or shown on
// its own if nothing else would have.
function applyShareFromUrl({ offlineStale = false } = {}) {
  if (!hasShareParams(location.search)) return;

  const decoded = decodeShare(location.search);
  scrubShareParamsFromUrl();

  const withOfflineWarning = msg => offlineStale ? `${msg} ${t('msg.shareOfflineStaleWarning')}` : msg;

  if (!decoded.ok) {
    showNotice(withOfflineWarning(decoded.reason === 'version' ? t('msg.shareVersion') : t('msg.shareInvalid')));
    return;
  }

  // A syntactically valid link (right version/carbType) can still carry no
  // usable setup data, e.g. if it was truncated in transit and lost its
  // s1..s5 params while v/c survived — encodeShare() never produces such a
  // link itself, so treat it the same as a corrupt one rather than silently
  // overwriting real local data with five blank slots. Checked on data
  // fields only (isSlotDataEmpty), not isSlotEmpty's name+data check: a
  // stray `n<N>` surviving without its `s<N>` would otherwise make
  // isSlotEmpty call that slot "not empty" on name alone and let a
  // link with zero real data slip past this guard.
  if (decoded.state.setups.every(isSlotDataEmpty)) {
    showNotice(withOfflineWarning(t('msg.shareInvalid')));
    return;
  }

  const importedKey = stateKey(decoded.state);
  if (importedKey === stateKey({ carbType, setups })) {
    // Nothing would actually change, but still worth flagging if the
    // values compared against a potentially stale offline database.
    if (offlineStale) showNotice(t('msg.shareOfflineStaleWarning'));
    return;
  }

  // Only offer Undo if there was something local worth restoring.
  const hasLocalData = !setups.every(isSlotEmpty);
  const snapshot = hasLocalData ? structuredClone({ setups, carbType }) : null;

  setups   = decoded.state.setups;
  carbType = decoded.state.carbType;
  saveSetups(setups);
  saveCarbType(carbType);

  importUndo = { snapshot, importedKey };
  showImportBanner();

  if (decoded.warnings.length > 0) {
    showNotice(withOfflineWarning(t('msg.shareFieldsIgnored').replace('{n}', decoded.warnings.length)));
  } else if (offlineStale) {
    showNotice(t('msg.shareOfflineStaleWarning'));
  }
}

// Registers sw.js for offline support. Never lets a registration failure
// (unsupported browser, blocked by a privacy setting, etc.) throw or block
// the rest of app init — this is a progressive enhancement, not a
// requirement for the app to work. Returns the registration (or null) so
// callers can drive the update-checking logic below off it.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js', { type: 'module' });
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

// ── Service worker update checking ──────────────────────────────────────────
//
// General background check (every app start): fire-and-forget, never
// awaited before rendering. If an update installs while there's already an
// existing controller (i.e. this isn't the very first install), a
// persistent banner offers to activate it.

let pendingUpdateRegistration = null;

// Never throws, never awaited by its caller.
function watchForServiceWorkerUpdate(registration) {
  if (!registration) return;

  registration.update().catch(() => {});

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    newWorker.addEventListener('statechange', () => {
      // 'installed' + an existing controller means this is an update to an
      // already-running app, not the very first install of the app.
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner(registration);
      }
    });
  });

  // A previous session may have left an update installed-but-waiting (the
  // banner was hidden, or the tab closed before "Update now" was clicked)
  // — surface it again now instead of losing track of it.
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner(registration);
  }
}

function showUpdateBanner(registration) {
  pendingUpdateRegistration = registration;
  const banner = document.getElementById('update-banner');
  if (banner) banner.hidden = false;
}

// Hides the banner for the rest of THIS page load only — nothing is
// persisted, so the banner is not permanently dismissible: if the update
// is still pending next time the app starts, watchForServiceWorkerUpdate()'s
// registration.waiting check brings it back.
function hideUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.hidden = true;
}

// Share-link-specific check (only meaningful when hasShareParams() is
// true): a share link must decode against the current needledb.js, not a
// stale cached one. There used to be an attempt here to race a pending
// service-worker update's activation against a timeout before deciding —
// but by the time any code in this file runs, the browser's ES module
// loader has already fetched and executed js/needledb.js (module scripts
// run before DOMContentLoaded, which is before this check ever could), so
// NEEDLE_DB for this page load is already bound to whatever was cached at
// that point. No amount of waiting for a service-worker update afterwards
// can make this page's own data any fresher — it could only affect a
// future page load. So the only thing worth checking is whether we're
// fully offline, since then the needledb.js this decodes against might
// not be the one the link's creator had.
function isShareLinkPossiblyStale() {
  return !navigator.onLine;
}

function showImportBanner() {
  const banner  = document.getElementById('import-banner');
  const undoBtn = document.getElementById('btn-import-undo');
  if (!banner) return;
  if (undoBtn) undoBtn.hidden = !importUndo?.snapshot;
  banner.hidden = false;
}

function hideImportBanner() {
  const banner = document.getElementById('import-banner');
  if (banner) banner.hidden = true;
  importUndo = null;
}

// ── Custom Needle form ────────────────────────────────────────────────────────

// One-time correction of stored custom needle lengths (see
// migrateCustomNeedles() in needledb.js). Idempotent: once saved, a second
// run finds nothing to change and shows no notice. showNotice() writes via
// textContent, so needle types are not HTML-escaped here (that would show
// literal entities).
function migrateStoredCustomNeedles() {
  const { needles, changes } = migrateCustomNeedles(loadCustomNeedles());
  if (changes.length === 0) return;
  saveCustomNeedles(needles);
  const list = changes
    .map(c => `${c.type} (${c.carbType}): ${c.from != null ? Number(c.from).toFixed(1) : '–'} → ${c.to.toFixed(1)} mm`)
    .join(', ');
  showNotice(t('msg.customLengthMigrated').replace('{n}', changes.length).replace('{needles}', list));
}

function updateLengthTypeVisibility() {
  const row = document.getElementById('cn-length-type-row');
  const carbTypeEl = document.querySelector('input[name="customCarbType"]:checked');
  if (row) row.hidden = carbTypeEl?.value !== 'VHSx';
}

function readNeedleForm() {
  const get = id => document.getElementById(id)?.value.trim();
  const getNum = id => { const v = get(id); return v === '' ? null : parseFloat(v); };
  const carbTypeEl = document.querySelector('input[name="customCarbType"]:checked');
  const carbType = carbTypeEl?.value ?? null;
  const lengthTypeEl = document.querySelector('input[name="cnLengthType"]:checked');

  return {
    carbType,
    // VHSx: from the K/U selection; PHBH/PHBL: fixed per carb type.
    length: getCustomNeedleLength(carbType, lengthTypeEl?.value),
    type: get('cn-type')?.toUpperCase(),
    A: getNum('cn-A'),
    B: getNum('cn-B'),
    C: getNum('cn-C'),
    D: getNum('cn-D'),
    E: getNum('cn-E'),
    F: getNum('cn-F'),
    clips: getNum('cn-clips') ?? 4,
  };
}

function validateNeedle(needle, showAlert = true) {
  const errors = [];
  if (!needle.carbType) errors.push(t('err.carbTypeRequired'));
  if (needle.carbType === 'VHSx' && needle.length == null) errors.push(t('err.lengthTypeRequired'));
  if (!needle.type) errors.push(t('err.typeRequired'));
  if (needle.A == null || needle.B == null || needle.C == null) errors.push(t('err.abcRequired'));
  if (needle.type && NEEDLE_DB[needle.type]) errors.push(t('err.typeExists'));
  if ((needle.D != null) !== (needle.E != null)) errors.push(t('err.deIncomplete'));
  if (needle.F != null && (needle.D == null || needle.E == null)) errors.push(t('err.fRequiresDe'));
  if (errors.length && showAlert) alert(errors.join('\n'));
  return errors.length === 0;
}

function renderCustomNeedleList() {
  const list = document.getElementById('cn-list');
  if (!list) return;
  const custom = loadCustomNeedles();
  if (custom.length === 0) {
    list.innerHTML = `<li class="empty">${t('needle.empty')}</li>`;
    return;
  }
  list.innerHTML = custom.map(n => {
    const tapers = n.F != null ? '3T' : n.E != null ? '2T' : '1T';
    const typeEsc = escapeHtml(n.type);
    return `<li>
      <span class="cn-name">${typeEsc}</span>
      ${n.carbType ? `<span class="cn-carb-badge">${escapeHtml(n.carbType)}</span>` : ''}
      <span class="cn-detail">${tapers} · A=${n.A} B=${n.B} C=${n.C}${n.D != null ? ` D=${n.D} E=${n.E}` : ''}${n.F != null ? ` F=${n.F}` : ''}</span>
      <button class="btn-delete-needle" data-type="${typeEsc}" title="Delete">✕</button>
    </li>`;
  }).join('');
}

function buildMailtoLink(needle) {
  const subject = encodeURIComponent(`Custom Needle Submission: ${needle.type}`);
  const body = encodeURIComponent(
    `Carb Type: ${needle.carbType}\r\n` +
    `Needle Type: ${needle.type}\r\n` +
    `A: ${needle.A}\r\n` +
    `B: ${needle.B}\r\n` +
    `C: ${needle.C}\r\n` +
    `D (optional): ${needle.D ?? ''}\r\n` +
    `E (optional): ${needle.E ?? ''}\r\n` +
    `F (optional): ${needle.F ?? ''}\r\n` +
    `\r\nSource / Reference (optional):\r\n`
  );
  return `mailto:jetting@ejais.de?subject=${subject}&body=${body}`;
}

// ── Demo data loader ──────────────────────────────────────────────────────────

const DEMO_SETUPS = [
  { id:1, name:'#1 Demo-1', needleType:'K98', clipPos:3, carbSize:30, needleJet:262, jetType:'DP', nd:53, hd:175 },
  { id:2, name:'#2 Demo-2', needleType:'K98', clipPos:1, carbSize:30, needleJet:268, jetType:'DQ', nd:53, hd:155 },
  { id:3, name:'#3 Demo-3', needleType:'K98', clipPos:1, carbSize:30, needleJet:267, jetType:'DQ', nd:55, hd:155 },
  { id:4, name:'#4', needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
  { id:5, name:'#5', needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
];

// ── Carburetor cross-section card ─────────────────────────────────────────────

function calcAnnulusArea(needleJetNum, needleDiamAtPos) {
  const njDiamMM = needleJetNum / 100;
  return Math.PI * (Math.pow(njDiamMM / 2, 2) - Math.pow(needleDiamAtPos / 2, 2));
}

// Shared SVG geometry constants — identical values used by builder and live-update
function csSVGConsts(njMM, needle) {
  const CX = 120, BORE_HALF = 34, JT = 168, JB = 252;
  // Per-needle vertical scale: map needle's taper length to a fixed drawing height so
  // short needles (small C) don't appear squashed relative to long ones.
  // SX stays fixed so bore-diameter comparisons remain visually meaningful across needles.
  const SY = 220 / needle.C;
  return { CX, BORE_HALF, SX: BORE_HALF / (njMM / 2), SY, JT, JB, YC: (JT + JB) / 2, HBAND: 9 };
}

// Ordered inflection points of the needle profile (tip to shank)
function csNeedleProf(needle) {
  const { A, B, C } = needle;
  const E = needle.E ?? 0, F = needle.F ?? 0, D = needle.D ?? A;
  const prof = [{ p: 0, r: B / 2 }];
  if (F > 0) prof.push({ p: F, r: B / 2 });
  if (E > 0) prof.push({ p: E, r: D / 2 });
  prof.push({ p: C, r: A / 2 }, { p: C + 55, r: A / 2 });
  return prof;
}

// Compute polygon points string for needle at a given pos
function csPolyPoints(prof, pos, { CX, SX, SY, YC }) {
  const yAt = p => YC - (p - pos) * SY;
  const xR  = r => r * SX;
  const right = prof.map(({ p, r }) =>
    `${(CX + xR(r)).toFixed(1)},${yAt(p).toFixed(1)}`).join(' ');
  const left  = [...prof].reverse().map(({ p, r }) =>
    `${(CX - xR(r)).toFixed(1)},${yAt(p).toFixed(1)}`).join(' ');
  return `${right} ${left}`;
}

// Compute annulus gap fill paths.
// Fills the radial space between the needle surface and the bore wall at YC.
// MIN_GAP (SVG units) ensures the indicator stays visible even when the needle
// nearly fills the bore (e.g. shank at idle with tiny clearance).
function csGapPaths(diam, { CX, SX, YC, BORE_HALF, HBAND }) {
  if (diam <= 0) return { gapR: 'M 0,0', gapL: 'M 0,0', showGap: false };
  const nRpx = (diam / 2) * SX;
  if (nRpx >= BORE_HALF) return { gapR: 'M 0,0', gapL: 'M 0,0', showGap: false };

  const MIN_GAP = 2.5;                                      // floor: always renders ≥ this wide
  const nReff = Math.min(nRpx, BORE_HALF - MIN_GAP);       // visual needle radius (with floor)

  const y1 = (YC - HBAND).toFixed(1), y2 = (YC + HBAND).toFixed(1);
  const nR = (CX + nReff).toFixed(1);   // needle right edge (visual)
  const bR = (CX + BORE_HALF).toFixed(1);
  const nL = (CX - nReff).toFixed(1);   // needle left edge (visual)
  const bL = (CX - BORE_HALF).toFixed(1);
  return {
    gapR: `M ${nR},${y1} H ${bR} V ${y2} H ${nR} Z`,
    gapL: `M ${bL},${y1} H ${nL} V ${y2} H ${bL} Z`,
    showGap: true,
  };
}

function renderCrossSection() {
  const sel = document.getElementById('cs-setup-select');
  const diag = document.getElementById('cross-section-diagram');
  if (!sel || !diag) return;

  // Remember currently selected id so we can restore it after re-render
  const prevId = sel.value ? parseInt(sel.value) : null;

  sel.innerHTML = setups.map(s =>
    `<option value="${s.id}">${escapeHtml(s.name)}</option>`
  ).join('');

  // Default: restore previous selection, or fall back to first setup with a needle
  const defaultSetup = prevId && setups.find(s => s.id === prevId)
    ? setups.find(s => s.id === prevId)
    : setups.find(s => s.needleType) ?? setups[0];
  sel.value = defaultSetup.id;

  updateCrossSectionDiagram();
}

function buildCrossSectionSVG(setup, result, idx) {
  const needle = getAllNeedles()[setup.needleType];
  if (!needle || !result) return '';

  const pt = result.curve[Math.min(idx, result.curve.length - 1)];
  const { pos, diam } = pt;
  const njMM   = setup.needleJet / 100;
  const consts = csSVGConsts(njMM, needle);
  const { CX, BORE_HALF, JT, JB } = consts;
  const prof   = csNeedleProf(needle);

  // W=280: extra 40 SVG units on right gives labels a 74-unit column
  // (right jet wall ends at x=184; body rect right edge now at x=258)
  const W = 280, H = 310;
  const CTOP = 12, CBOT = 298, BTOP = 36, JWALL = 30;

  const polyPoints             = csPolyPoints(prof, pos, consts);
  const { gapR, gapL, showGap } = csGapPaths(diam, consts);

  const lbl = (x, y, s, anchor = 'start', key = '') =>
    `<text x="${x}" y="${y}" font-size="9" font-family="inherit" fill="var(--text-muted)" text-anchor="${anchor}"${key ? ` data-i18n="${key}"` : ''}>${s}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" overflow="hidden"
               xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="cs-jet-clip">
      <rect x="${CX - BORE_HALF}" y="${JT}" width="${BORE_HALF * 2}" height="${JB - JT}"/>
    </clipPath>
    <clipPath id="cs-body-clip">
      <rect x="22" y="${CTOP}" width="${W - 44}" height="${CBOT - CTOP}"/>
    </clipPath>
  </defs>
  <rect x="22" y="${CTOP}" width="${W - 44}" height="${CBOT - CTOP}"
        rx="5" fill="var(--border)" fill-opacity="0.22"/>
  <rect x="${CX - 44}" y="${CTOP}" width="88" height="${JT - CTOP}" fill="var(--bg)"/>
  <line x1="${CX - 44}" y1="${BTOP}" x2="${CX - 44}" y2="${JT}"
        stroke="var(--text-muted)" stroke-width="1"/>
  <line x1="${CX + 44}" y1="${BTOP}" x2="${CX + 44}" y2="${JT}"
        stroke="var(--text-muted)" stroke-width="1"/>
  <rect x="${CX - BORE_HALF - JWALL}" y="${JT}" width="${JWALL}" height="${JB - JT}"
        fill="var(--header-bg)" fill-opacity="0.75"/>
  <rect x="${CX + BORE_HALF}" y="${JT}" width="${JWALL}" height="${JB - JT}"
        fill="var(--header-bg)" fill-opacity="0.75"/>
  <rect x="${CX - BORE_HALF}" y="${JB}" width="${BORE_HALF * 2}" height="${CBOT - JB}"
        fill="var(--bg)" fill-opacity="0.55"/>
  <rect x="22" y="${CTOP}" width="${W - 44}" height="${CBOT - CTOP}"
        rx="5" fill="none" stroke="var(--text-muted)" stroke-width="1.5"/>
  <g clip-path="url(#cs-body-clip)">
    <polygon id="cs-needle-poly" points="${polyPoints}"
             fill="var(--accent)" fill-opacity="0.14"
             stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <g id="cs-gap-g"
     fill="var(--warning)" fill-opacity="0.85"
     display="${showGap ? '' : 'none'}">
    <path id="cs-gap-r" d="${gapR}"/>
    <path id="cs-gap-l" d="${gapL}"/>
  </g>
  ${lbl(W - 22 - 5, JT + 15, `Ø ${njMM.toFixed(2)} mm`, 'end')}
  ${lbl(W - 22 - 5, JT + 26, t('crosssection.needleJet'), 'end', 'crosssection.needleJet')}
  ${lbl(W - 22 - 5, BTOP + 13, t('crosssection.bore'), 'end', 'crosssection.bore')}
  ${lbl(CX - 47, BTOP + 13, escapeHtml(setup.needleType), 'end')}
</svg>`;
}

// Full diagram rebuild -- called on setup change and initial render
function updateCrossSectionDiagram() {
  const sel    = document.getElementById('cs-setup-select');
  const slider = document.getElementById('cs-throttle-slider');
  const tpDisp = document.getElementById('cs-throttle-value');
  const diag   = document.getElementById('cross-section-diagram');
  if (!sel || !diag) return;

  const throttlePct = slider ? parseInt(slider.value) : 0;
  if (tpDisp) tpDisp.textContent = `${throttlePct}%`;
  document.getElementById('cs-extrap-note')?.toggleAttribute('hidden', throttlePct <= 100);

  const setup = setups.find(s => s.id === parseInt(sel.value));
  if (!setup?.needleType) {
    diag.innerHTML = `<p class="cs-empty">${t('crosssection.empty')}</p>`;
    return;
  }

  const result = calcSetup(setup, getAllNeedles());
  if (!result) {
    diag.innerHTML = `<p class="cs-empty">${t('crosssection.empty')}</p>`;
    return;
  }

  const idx     = throttlePct / 5;
  const pt      = result.curve[Math.min(idx, result.curve.length - 1)];
  const annulus = calcAnnulusArea(setup.needleJet, pt.diam);
  const svgHTML = buildCrossSectionSVG(setup, result, idx);

  const needleClear = pt.pos < 0;
  diag.innerHTML = `
    <div class="cs-diagram-wrap">${svgHTML}</div>
    <p class="cs-gap-note" data-i18n="crosssection.gapVisualNote">${t('crosssection.gapVisualNote')}</p>
    <p class="cs-disclaimer" data-i18n="crosssection.disclaimer">${t('crosssection.disclaimer')}</p>
    <p id="cs-needle-clear-msg" class="cs-needle-clear" data-i18n="crosssection.needleClear"
       style="${needleClear ? '' : 'display:none'}">${t('crosssection.needleClear')}</p>
    <dl class="cs-readout">
      <div class="cs-readout-row">
        <dt>${t('crosssection.needlePos')}</dt>
        <dd id="cs-dd-pos">${pt.pos.toFixed(2)} mm</dd>
      </div>
      <div class="cs-readout-row">
        <dt>${t('crosssection.needleDiam')}</dt>
        <dd id="cs-dd-diam">${pt.diam.toFixed(3)} mm</dd>
      </div>
      <div class="cs-readout-row">
        <dt>${t('crosssection.annulus')}</dt>
        <dd id="cs-dd-annulus">${annulus.toFixed(2)} mm²</dd>
      </div>
    </dl>`;
  applyTranslations();
}

// Attribute-only update -- called on slider input for smooth live feedback
function updateCrossSectionLive() {
  const sel    = document.getElementById('cs-setup-select');
  const slider = document.getElementById('cs-throttle-slider');
  const tpDisp = document.getElementById('cs-throttle-value');
  if (!sel) return;

  const throttlePct = slider ? parseInt(slider.value) : 0;
  if (tpDisp) tpDisp.textContent = `${throttlePct}%`;
  document.getElementById('cs-extrap-note')?.toggleAttribute('hidden', throttlePct <= 100);

  const setup = setups.find(s => s.id === parseInt(sel.value));
  if (!setup?.needleType) return;

  const needle = getAllNeedles()[setup.needleType];
  const result = calcSetup(setup, getAllNeedles());
  if (!needle || !result) return;

  const idx     = throttlePct / 5;
  const pt      = result.curve[Math.min(idx, result.curve.length - 1)];
  const { pos, diam } = pt;
  const annulus = calcAnnulusArea(setup.needleJet, diam);
  const consts  = csSVGConsts(setup.needleJet / 100, needle);
  const prof    = csNeedleProf(needle);

  // Update needle polygon points
  const poly = document.getElementById('cs-needle-poly');
  if (poly) poly.setAttribute('points', csPolyPoints(prof, pos, consts));

  // Update gap highlight paths
  const { gapR, gapL, showGap } = csGapPaths(diam, consts);
  const gapG = document.getElementById('cs-gap-g');
  const elR  = document.getElementById('cs-gap-r');
  const elL  = document.getElementById('cs-gap-l');
  if (gapG) gapG.setAttribute('display', showGap ? '' : 'none');
  if (elR)  elR.setAttribute('d', gapR);
  if (elL)  elL.setAttribute('d', gapL);

  // Show/hide needle-clear message
  const clearMsg = document.getElementById('cs-needle-clear-msg');
  if (clearMsg) clearMsg.style.display = pos < 0 ? '' : 'none';

  // Update readout text
  const ddPos  = document.getElementById('cs-dd-pos');
  const ddDiam = document.getElementById('cs-dd-diam');
  const ddAnn  = document.getElementById('cs-dd-annulus');
  if (ddPos)  ddPos.textContent  = `${pos.toFixed(2)} mm`;
  if (ddDiam) ddDiam.textContent = `${diam.toFixed(3)} mm`;
  if (ddAnn)  ddAnn.textContent  = `${annulus.toFixed(2)} mm²`;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Register the service worker in the background — fire-and-forget, never
  // awaited, so a slow/failed registration or update check can't delay
  // rendering.
  registerServiceWorker().then(watchForServiceWorkerUpdate).catch(() => {});

  // Needle schematics: mounted before the first applyTranslations() (which
  // updateUI() already triggers), so their data-i18n texts get translated.
  mountNeedleSchematic(document.querySelector('[data-schematic="custom"]'), 'custom');
  mountNeedleSchematic(document.querySelector('[data-schematic="catalog"]'), 'catalog');

  // Apply a share link (if present in the URL) before anything else reads
  // `setups`/`carbType`, so the very first render already reflects it.
  const shareOfflineStale = hasShareParams(location.search) && isShareLinkPossiblyStale();
  applyShareFromUrl({ offlineStale: shareOfflineStale });

  // Correct stored custom needle lengths before the first render. Runs after
  // the share import so its one-time notice is not replaced by a share notice.
  migrateStoredCustomNeedles();

  // iOS Safari never fires 'beforeinstallprompt', so it needs its own
  // one-time check to decide whether #btn-install should appear at all.
  maybeShowIosInstallButton();

  // Initialize carb type radios from persisted state
  document.querySelectorAll('input[name="carbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });
  document.querySelectorAll('input[name="customCarbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });
  updateLengthTypeVisibility();

  updateUI();
  renderCustomNeedleList();
  applyTranslations();

  // View tabs + history (initial view is picked below, once dark mode is
  // applied, so a direct '#needles' load renders dots in the right colors).
  document.getElementById('tab-calc')?.addEventListener('click', () => showView('calc'));
  document.getElementById('tab-catalog')?.addEventListener('click', () => showView('needles'));
  document.getElementById('view-tabs')?.addEventListener('keydown', handleViewTabKeydown);
  const syncViewFromHash = () => {
    if (hashToView() !== currentView) showView(hashToView(), { push: false });
  };
  window.addEventListener('popstate', syncViewFromHash);
  window.addEventListener('hashchange', syncViewFromHash);

  // Needle catalog: filters/sort re-render; the search box only re-renders
  // the table so it keeps focus while typing.
  document.getElementById('catalog-controls')?.addEventListener('click', handleCatalogControlClick);
  document.getElementById('catalog-legend-toggle')?.addEventListener('click', () => {
    catalogState.legendOpen = !catalogState.legendOpen;
    renderCatalogLegend();
  });
  document.getElementById('catalog-table')?.addEventListener('click', handleCatalogSortClick);
  document.getElementById('catalog-search')?.addEventListener('input', e => {
    catalogState.query = e.target.value;
    renderCatalogTable();
  });

  // Custom needle form: toggle K/U length-type selector for VHSx
  document.getElementById('custom-needle-form')?.addEventListener('change', e => {
    if (e.target.name === 'customCarbType') updateLengthTypeVisibility();
  });

  // Carb type selector
  document.getElementById('carb-type-selector')?.addEventListener('change', e => {
    const r = e.target.closest('input[name="carbType"]');
    if (!r) return;
    handleCarbTypeChange(r.value);
    applyTranslations();
  });

  // Setup table changes (event delegation)
  document.getElementById('setup-tbody').addEventListener('change', e => {
    const el = e.target.closest('[data-id][data-field]');
    if (!el) return;
    handleFieldChange(parseInt(el.dataset.id), el.dataset.field, el.value);
  });

  // Setup table row actions (event delegation)
  document.getElementById('setup-tbody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'reset-row') resetRow(id);
    if (btn.dataset.action === 'duplicate-row') duplicateRow(id);
  });

  // Cross-section setup selector and throttle slider
  document.getElementById('cs-setup-select')?.addEventListener('change', updateCrossSectionDiagram);
  document.getElementById('cs-throttle-slider')?.addEventListener('input', updateCrossSectionLive);

  // Load demo data (demo uses K98/DP → VHSx)
  document.getElementById('btn-load-demo')?.addEventListener('click', () => {
    if (!confirm(t('confirm.loadDemo'))) return;
    setups = structuredClone(DEMO_SETUPS);
    saveSetups(setups);
    carbType = 'VHSx';
    saveCarbType(carbType);
    updateUI();
  });

  // Reset all setups
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (!confirm(t('confirm.resetAll'))) return;
    setups = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, name: `#${i + 1}`,
      needleType: null, clipPos: null, carbSize: null,
      needleJet: null, jetType: null, nd: null, hd: null,
    }));
    saveSetups(setups);
    updateUI();
  });

  // Save custom needle
  document.getElementById('btn-save-needle')?.addEventListener('click', () => {
    const needle = readNeedleForm();
    if (!validateNeedle(needle)) return;

    const custom = loadCustomNeedles();
    const existingIdx = custom.findIndex(n => n.type === needle.type);
    if (existingIdx >= 0) {
      if (!confirm(t('confirm.overwriteNeedle').replace('${type}', needle.type))) return;
      custom[existingIdx] = needle;
    } else {
      custom.push(needle);
    }
    saveCustomNeedles(custom);
    renderCustomNeedleList();
    updateUI();
    document.getElementById('custom-needle-form').reset();
    updateLengthTypeVisibility();
  });

  // Submit needle via mailto
  document.getElementById('btn-submit-needle')?.addEventListener('click', () => {
    const needle = readNeedleForm();
    if (!validateNeedle(needle)) return;
    window.location.href = buildMailtoLink(needle);
  });

  // Delete custom needle (delegated)
  document.getElementById('cn-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete-needle');
    if (!btn) return;
    const type = btn.dataset.type;
    if (!confirm(t('confirm.deleteNeedle').replace('${type}', type))) return;
    const custom = loadCustomNeedles().filter(n => n.type !== type);
    saveCustomNeedles(custom);
    renderCustomNeedleList();
    updateUI();
  });

  // Dark mode toggle
  const btnDark = document.getElementById('btn-darkmode');
  const updateDarkBtn = () => {
    if (btnDark) btnDark.textContent = document.body.classList.contains('dark') ? t('btn.lightMode') : t('btn.darkMode');
  };
  btnDark?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
    updateDarkBtn();
    // Setup dots in the catalog use getColors(), which depends on the theme.
    if (currentView === 'needles') renderCatalogTable();
  });
  if (localStorage.getItem('darkMode') === '1') document.body.classList.add('dark');
  updateDarkBtn();

  // Initial view from the hash — after applyShareFromUrl(), whose
  // scrubShareParamsFromUrl() keeps the hash intact.
  showView(hashToView(), { push: false });

  // Language toggle
  document.getElementById('btn-lang')?.addEventListener('click', () => {
    setLang(getLang() === 'en' ? 'de' : 'en');
    updateUI();
    renderCustomNeedleList();
    updateDarkBtn();
  });

  // Chart expand modal — icon button and chart-wrap click both open the modal
  document.getElementById('expand-needle')?.addEventListener('click', () => openChartModal('needle'));
  document.getElementById('expand-carb')?.addEventListener('click',   () => openChartModal('carb'));
  document.getElementById('needle-wrap')?.addEventListener('click',   () => openChartModal('needle'));
  document.getElementById('carb-wrap')?.addEventListener('click',     () => openChartModal('carb'));
  document.getElementById('chart-modal-close')?.addEventListener('click', closeChartModal);
  document.getElementById('chart-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeChartModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeChartModal(); hideTooltip(); }
  });

  // Share dialog
  document.getElementById('btn-share')?.addEventListener('click', openShareDialog);
  document.getElementById('btn-share-copy')?.addEventListener('click', copyShareLink);
  document.getElementById('btn-share-close')?.addEventListener('click', () => {
    document.getElementById('share-dialog')?.close();
  });
  document.getElementById('share-dialog')?.addEventListener('click', e => {
    const dialog = e.currentTarget;
    if (e.target !== dialog) return; // click landed on dialog content, not the backdrop
    const rect = dialog.getBoundingClientRect();
    const inDialog = e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inDialog) dialog.close();
  });

  // Install App button (native Chromium prompt, or iOS instructions dialog)
  document.getElementById('btn-install')?.addEventListener('click', handleInstallButtonClick);
  document.getElementById('btn-install-dialog-close')?.addEventListener('click', () => {
    document.getElementById('install-dialog')?.close();
  });
  document.getElementById('install-dialog')?.addEventListener('click', e => {
    const dialog = e.currentTarget;
    if (e.target !== dialog) return; // click landed on dialog content, not the backdrop
    const rect = dialog.getBoundingClientRect();
    const inDialog = e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inDialog) dialog.close();
  });

  // Import banner (shown once, when a share link was applied at page load)
  document.getElementById('btn-import-undo')?.addEventListener('click', () => {
    if (!importUndo?.snapshot) return;
    setups   = importUndo.snapshot.setups;
    carbType = importUndo.snapshot.carbType;
    saveSetups(setups);
    saveCarbType(carbType);
    updateUI(); // its central check hides the banner once state != importedKey
  });
  document.getElementById('btn-import-close')?.addEventListener('click', hideImportBanner);

  // Update banner (shown when a new service-worker version has installed)
  document.getElementById('btn-update-now')?.addEventListener('click', () => {
    const waitingWorker = pendingUpdateRegistration?.waiting;
    if (!waitingWorker) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });
  document.getElementById('btn-update-close')?.addEventListener('click', hideUpdateBanner);

  // ── Tooltip (data-tooltip attribute) — hover + tap ──────────────────────
  const tip = document.createElement('div');
  tip.className = 'tooltip-box';
  tip.hidden = true;
  document.body.appendChild(tip);

  let tipTarget = null;

  function showTooltip(anchor) {
    tip.textContent = anchor.dataset.tooltip;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const gap = 8;
    tip.style.left = '0';
    tip.style.top  = '0';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    let top  = r.top - th - gap;
    if (top < gap) top = r.bottom + gap;
    left = Math.max(gap, Math.min(left, window.innerWidth - tw - gap));
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
    tipTarget = anchor;
  }

  function hideTooltip() {
    tip.hidden = true;
    tipTarget = null;
  }

  document.addEventListener('mouseover', e => {
    const anchor = e.target.closest('[data-tooltip]');
    if (anchor) showTooltip(anchor);
    else if (tipTarget && !tipTarget.contains(e.target)) hideTooltip();
  });

  document.addEventListener('click', e => {
    const anchor = e.target.closest('[data-tooltip]');
    if (anchor) {
      if (tipTarget === anchor) { hideTooltip(); return; }
      showTooltip(anchor);
      e.stopPropagation();
      return;
    }
    if (tipTarget) hideTooltip();
  }, true);
});
