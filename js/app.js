// app.js — UI logic, event handling
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { loadSetups, saveSetups, loadCustomNeedles, saveCustomNeedles, getAllNeedles, loadCarbType, saveCarbType } from './storage.js';
import { calcSetup } from './calc.js';
import { calcCutaway, snapToSlide, isRoundSlide2Stroke } from './cutaway.js';
import { renderCharts, openChartModal, closeChartModal, getColors } from './charts.js';
import { NEEDLE_DB, CARB_TYPES } from './needledb.js';
import { t, getLang, setLang, applyTranslations } from './i18n.js';

let setups   = loadSetups();
let carbType = loadCarbType();

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    keys.map(k =>
      `<option value="${k}"${k === selectedType ? ' selected' : ''}${customTypes.includes(k) ? ' class="custom-needle"' : ''}>${k}${customTypes.includes(k) ? ' *' : ''}</option>`
    ).join('');
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
      const slide = snapToSlide(ca.cutawayClamped, carbType);
      if (ca.ratioOk) {
        cutawayCell = `<span class="cutaway-col-value">${slide}</span>`;
      } else {
        const tipText = t('cutaway.colWarning').replace('{ratio}', ca.ratio.toFixed(2)).replace('{section}', t('section.calcResults'));
        cutawayCell = `<span class="cutaway-col-value">${slide}</span><span class="cutaway-col-warn" data-tooltip="${tipText}" role="button" tabindex="0" aria-label="${tipText}">⚠</span>`;
      }
    }

    return `
    <tr>
      <td>
        <input type="text" class="cell-input" data-id="${s.id}" data-field="name"
               value="${s.name}" title="Setup name">
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="needleType">
          ${buildNeedleOptions(s.needleType)}
        </select>
      </td>
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="clipPos"
               value="${s.clipPos ?? ''}" min="1" max="4" placeholder="1–4">
      </td>
      <td class="carbsize-cell">
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="carbSize"
               value="${s.carbSize ?? ''}" min="10" max="50" placeholder="mm">
        ${carbType === 'PHBL' && s.carbSize > 26 ? `<span class="field-warn" data-tooltip="${t('carbSize.phblWarning')}" role="button" tabindex="0" aria-label="${t('carbSize.phblWarning')}">⚠</span>` : ''}
      </td>
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="needleJet"
               value="${s.needleJet ?? ''}" min="100" max="400" placeholder="×10">
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="jetType"
                title="${t('col.jetType.title')}">
          <option value="">—</option>
          ${validAtomizers.map(a => `<option value="${a}"${s.jetType === a ? ' selected' : ''}>${a}</option>`).join('')}
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
    const rows = result.curve.map(p => `
      <tr>
        <td>${Math.round(p.tp * 100)}%</td>
        <td>${p.pos.toFixed(2)}</td>
        <td>${p.diam.toFixed(3)}</td>
        <td>${Math.round(p.hdEquiv)}</td>
        <td>${Math.round(p.overall)}</td>
      </tr>`).join('');

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
          <caption style="color:${color}">${s.name}</caption>
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
        ${cutawayHTML}
      </div>`;
  }).join('');
}

function updateUI() {
  document.querySelectorAll('input[name="carbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });
  const banner = document.getElementById('phbl-beta-banner');
  if (banner) banner.hidden = carbType !== 'PHBL';
  renderTable();
  renderCharts(setups, getAllNeedles());
  renderCalcResults();
  renderCrossSection();
}

// ── Carb type change ──────────────────────────────────────────────────────────

function handleCarbTypeChange(newCarbType) {
  carbType = newCarbType;
  saveCarbType(carbType);

  const allNeedles     = getAllNeedles();
  const validAtomizers = CARB_TYPES[carbType].atomizers;

  let resetCount = 0;
  setups.forEach(s => {
    let changed = false;
    if (s.needleType && allNeedles[s.needleType]?.carbType !== carbType) {
      s.needleType = null;
      changed = true;
    }
    if (s.jetType && !validAtomizers.includes(s.jetType)) {
      s.jetType = null;
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

function handleFieldChange(id, field, value) {
  const idx = setups.findIndex(s => s.id === id);
  if (idx === -1) return;

  const numFields = ['clipPos', 'carbSize', 'needleJet', 'nd', 'hd'];
  if (numFields.includes(field)) {
    setups[idx][field] = value === '' ? null : parseFloat(value);
  } else {
    setups[idx][field] = value === '' ? null : value;
  }

  saveSetups(setups);
  updateUI();
}

// ── Custom Needle form ────────────────────────────────────────────────────────

function readNeedleForm() {
  const get = id => document.getElementById(id)?.value.trim();
  const getNum = id => { const v = get(id); return v === '' ? null : parseFloat(v); };
  const carbTypeEl = document.querySelector('input[name="customCarbType"]:checked');
  return {
    carbType: carbTypeEl?.value ?? null,
    type: get('cn-type')?.toUpperCase(),
    A: getNum('cn-A'),
    B: getNum('cn-B'),
    C: getNum('cn-C'),
    D: getNum('cn-D'),
    E: getNum('cn-E'),
    F: getNum('cn-F'),
  };
}

function validateNeedle(needle, showAlert = true) {
  const errors = [];
  if (!needle.carbType) errors.push(t('err.carbTypeRequired'));
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
    return `<li>
      <span class="cn-name">${n.type}</span>
      ${n.carbType ? `<span class="cn-carb-badge">${n.carbType}</span>` : ''}
      <span class="cn-detail">${tapers} · A=${n.A} B=${n.B} C=${n.C}${n.D != null ? ` D=${n.D} E=${n.E}` : ''}${n.F != null ? ` F=${n.F}` : ''}</span>
      <button class="btn-delete-needle" data-type="${n.type}" title="Delete">✕</button>
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

// Compute bore-boundary indicator paths.
// The orange stripe is a fixed 5px band centered exactly on the bore line (CX ± BORE_HALF).
// This is the SAME x-coordinate used by both the grey wall inner edge and the bore reference
// line — one shared value, zero gap possible.
// The stripe has no clip path so it spans both sides of the boundary,
// reading as "highlighted wall edge" not "floating element."
function csGapPaths(diam, { CX, SX, YC, BORE_HALF, HBAND }) {
  if (diam <= 0) return { gapR: 'M 0,0', gapL: 'M 0,0', showGap: false };
  const nRpx = (diam / 2) * SX;
  if (nRpx >= BORE_HALF) return { gapR: 'M 0,0', gapL: 'M 0,0', showGap: false };

  const SW = 2.5;                                            // half-width: 5px total stripe
  const bL = CX - BORE_HALF;                                // bore line left  (shared x)
  const bR = CX + BORE_HALF;                                // bore line right (shared x)
  const y1 = (YC - HBAND).toFixed(1), y2 = (YC + HBAND).toFixed(1);
  return {
    gapR: `M ${(bR - SW).toFixed(1)},${y1} H ${(bR + SW).toFixed(1)} V ${y2} H ${(bR - SW).toFixed(1)} Z`,
    gapL: `M ${(bL - SW).toFixed(1)},${y1} H ${(bL + SW).toFixed(1)} V ${y2} H ${(bL - SW).toFixed(1)} Z`,
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
    `<option value="${s.id}">${s.name}</option>`
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

  const W = 240, H = 310;
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
  ${lbl(CX + BORE_HALF + JWALL + 3, JT + 15, `Ø ${njMM.toFixed(2)} mm`)}
  ${lbl(CX + BORE_HALF + JWALL + 3, JT + 26, t('crosssection.needleJet'), 'start', 'crosssection.needleJet')}
  ${lbl(CX + 47, BTOP + 13, t('crosssection.bore'), 'start', 'crosssection.bore')}
  ${lbl(CX - 47, BTOP + 13, setup.needleType, 'end')}
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
  // Initialize carb type radios from persisted state
  document.querySelectorAll('input[name="carbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });
  document.querySelectorAll('input[name="customCarbType"]').forEach(r => {
    r.checked = r.value === carbType;
  });

  updateUI();
  renderCustomNeedleList();
  applyTranslations();

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
  });
  if (localStorage.getItem('darkMode') === '1') document.body.classList.add('dark');
  updateDarkBtn();

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
