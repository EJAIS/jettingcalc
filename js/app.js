// app.js — UI logic, event handling
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { loadSetups, saveSetups, loadCustomNeedles, saveCustomNeedles, getAllNeedles } from './storage.js';
import { calcSetup } from './calc.js';
import { renderCharts } from './charts.js';
import { NEEDLE_DB } from './needledb.js';

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
  return `<option value="">— select —</option>` +
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

function updateUI() {
  renderTable();
  renderCharts(setups, getAllNeedles());
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
    a: getNum('cn-a'),
    b: getNum('cn-b'),
    c: getNum('cn-c'),
    d: getNum('cn-d'),
    e: getNum('cn-e'),
    f: getNum('cn-f'),
  };
}

function validateNeedle(needle, showAlert = true) {
  const errors = [];
  if (!needle.type) errors.push('Needle type is required (e.g. K99).');
  if (needle.a == null) errors.push('Field a (max diameter) is required.');
  if (needle.b == null) errors.push('Field b (min diameter) is required.');
  if (needle.c == null) errors.push('Field c (taper start) is required.');
  if (NEEDLE_DB[needle.type]) errors.push(`"${needle.type}" already exists in the built-in database.`);
  if ((needle.d != null) !== (needle.e != null))
    errors.push('Fields d and e must both be filled or both be empty.');
  if (needle.f != null && (needle.d == null || needle.e == null))
    errors.push('Field f requires d and e to be set.');
  if (errors.length && showAlert) alert(errors.join('\n'));
  return errors.length === 0;
}

function renderCustomNeedleList() {
  const list = document.getElementById('cn-list');
  if (!list) return;
  const custom = loadCustomNeedles();
  if (custom.length === 0) {
    list.innerHTML = '<li class="empty">No custom needles saved.</li>';
    return;
  }
  list.innerHTML = custom.map(n => {
    const tapers = n.f != null ? '3T' : n.e != null ? '2T' : '1T';
    return `<li>
      <span class="cn-name">${n.type}</span>
      <span class="cn-detail">${tapers} · a=${n.a} b=${n.b} c=${n.c}${n.d != null ? ` d=${n.d} e=${n.e}` : ''}${n.f != null ? ` f=${n.f}` : ''}</span>
      <button class="btn-delete-needle" data-type="${n.type}" title="Delete">✕</button>
    </li>`;
  }).join('');
}

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

// ── Demo data loader ──────────────────────────────────────────────────────────

const DEMO_SETUPS = [
  { id:1, name:'#1 Simonini Grund',    needleType:'K98', clipPos:3, carbSize:30, needleJet:262, jetType:'DP', nd:53, hd:175 },
  { id:2, name:'#2 Simonini 6.6.23',   needleType:'K98', clipPos:1, carbSize:30, needleJet:268, jetType:'DQ', nd:53, hd:155 },
  { id:3, name:'#3 Test',              needleType:'K98', clipPos:1, carbSize:30, needleJet:267, jetType:'DQ', nd:55, hd:155 },
  { id:4, name:'#4', needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
  { id:5, name:'#5', needleType:null, clipPos:null, carbSize:null, needleJet:null, jetType:null, nd:null, hd:null },
];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  renderCustomNeedleList();

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
    if (btnDark) btnDark.textContent = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
  };
  btnDark?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
    updateDarkBtn();
  });
  if (localStorage.getItem('darkMode') === '1') document.body.classList.add('dark');
  updateDarkBtn();
});
