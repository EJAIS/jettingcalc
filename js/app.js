// app.js — UI logic, event handling
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { loadSetups, saveSetups, loadCustomNeedles, saveCustomNeedles, getAllNeedles } from './storage.js';
import { calcSetup } from './calc.js';
import { renderCharts, openChartModal, closeChartModal, COLORS } from './charts.js';
import { NEEDLE_DB } from './needledb.js';
import { t, getLang, setLang, applyTranslations } from './i18n.js';

let setups = loadSetups();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAllNeedlesSorted() {
  const all = getAllNeedles();
  return Object.keys(all).sort((a, b) => {
    // Sort K before U, then numerically
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });
}

function buildNeedleOptions(selectedType) {
  const keys = getAllNeedlesSorted();
  const custom = loadCustomNeedles().map(n => n.type);
  return `<option value="">${t('setup.select')}</option>` +
    keys.map(k =>
      `<option value="${k}"${k === selectedType ? ' selected' : ''}${custom.includes(k) ? ' class="custom-needle"' : ''}>${k}${custom.includes(k) ? ' *' : ''}</option>`
    ).join('');
}

// ── Table rendering ───────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('setup-tbody');
  if (!tbody) return;

  const allNeedles = getAllNeedles();

  tbody.innerHTML = setups.map(s => {
    const result = s.needleType ? calcSetup(s, allNeedles) : null;
    const maxHD  = result ? Math.round(result.maxHD) : '—';

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
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="carbSize"
               value="${s.carbSize ?? ''}" min="10" max="50" placeholder="mm">
      </td>
      <td>
        <input type="number" class="cell-input num" data-id="${s.id}" data-field="needleJet"
               value="${s.needleJet ?? ''}" min="100" max="400" placeholder="×10">
      </td>
      <td>
        <select class="cell-input" data-id="${s.id}" data-field="jetType">
          <option value="">—</option>
          <option value="DP"${s.jetType === 'DP' ? ' selected' : ''}>DP</option>
          <option value="DQ"${s.jetType === 'DQ' ? ' selected' : ''}>DQ</option>
          <option value="ET"${s.jetType === 'ET' ? ' selected' : ''}>ET</option>
        </select>
      </td>
      <td class="maxhd-cell">${maxHD}</td>
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
    container.innerHTML = '<p class="cr-empty">No active setups to display.</p>';
    return;
  }

  container.innerHTML = activeSetups.map(s => {
    const result = calcSetup(s, allNeedles);
    if (!result) return '';
    const color = COLORS[s.id - 1];
    const rows = result.curve.map(p => `
      <tr>
        <td>${Math.round(p.tp * 100)}%</td>
        <td>${p.pos.toFixed(2)}</td>
        <td>${p.diam.toFixed(3)}</td>
        <td>${Math.round(p.hdEquiv)}</td>
        <td>${Math.round(p.overall)}</td>
      </tr>`).join('');
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
      </div>`;
  }).join('');
}

function updateUI() {
  renderTable();
  renderCharts(setups, getAllNeedles());
  renderCalcResults();
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
  const getNum = id => {
    const v = get(id);
    return v === '' ? null : parseFloat(v);
  };
  return {
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
      <span class="cn-detail">${tapers} · A=${n.A} B=${n.B} C=${n.C}${n.D != null ? ` D=${n.D} E=${n.E}` : ''}${n.F != null ? ` F=${n.F}` : ''}</span>
      <button class="btn-delete-needle" data-type="${n.type}" title="Delete">✕</button>
    </li>`;
  }).join('');
}

function buildMailtoLink(needle) {
  const subject = encodeURIComponent(`Custom Needle Submission: ${needle.type}`);
  const body = encodeURIComponent(
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

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  renderCustomNeedleList();
  applyTranslations();

  // Setup table changes (event delegation)
  document.getElementById('setup-tbody').addEventListener('change', e => {
    const el = e.target.closest('[data-id][data-field]');
    if (!el) return;
    handleFieldChange(parseInt(el.dataset.id), el.dataset.field, el.value);
  });

  // Load demo data
  document.getElementById('btn-load-demo')?.addEventListener('click', () => {
    if (!confirm('Load demo setups? This will overwrite your current data.')) return;
    setups = structuredClone(DEMO_SETUPS);
    saveSetups(setups);
    updateUI();
  });

  // Reset all setups
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (!confirm('Reset all setups to empty?')) return;
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
      if (!confirm(`"${needle.type}" already exists as a custom needle. Overwrite?`)) return;
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
    if (!confirm(`Delete custom needle "${type}"?`)) return;
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
    if (e.key === 'Escape') closeChartModal();
  });
});
