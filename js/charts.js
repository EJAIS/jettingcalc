// charts.js — Chart.js diagram rendering
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { calcSetup } from './calc.js';
import { t } from './i18n.js';

let needleChart = null;
let carbChart   = null;
let modalChart  = null;

// Stored configs for modal re-render
let needleConfig = null;
let carbConfig   = null;

export const COLORS = ['#2e8b7a', '#e07b39', '#6a5acd', '#c0392b', '#27ae60'];

export function renderCharts(setups, needleSource) {
  const activeSetups = setups.filter(s => s.needleType);

  // --- Needle Profile ---
  // Use the actual throttle-travel range from calcSetup rather than the full needle geometry,
  // so each setup shows only the positions reached during throttle travel (matching Excel).
  const needleDatasets = activeSetups.map(s => {
    const result = calcSetup(s, needleSource);
    if (!result) return null;
    return {
      label: s.name,
      data: result.curve.map(p => ({ x: p.tp, y: p.diam })),
      borderColor: COLORS[s.id - 1],
      backgroundColor: COLORS[s.id - 1] + '22',
      tension: 0.3,
      pointRadius: 2,
    };
  }).filter(Boolean);

  needleConfig = {
    type: 'line',
    data: { datasets: needleDatasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)} mm`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: t('chart.needleX') },
          min: 0,
          max: 1.15,
          ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        },
        y: {
          title: { display: true, text: t('chart.needleY') },
        },
      },
    },
  };

  if (needleChart) needleChart.destroy();
  needleChart = new Chart(document.getElementById('needleChart'), needleConfig);

  // --- Carb Profile ---
  const carbDatasets = activeSetups.map(s => {
    const result = calcSetup(s, needleSource);
    if (!result) return null;
    return {
      label: s.name,
      data: result.curve.map(p => ({ x: p.tp, y: p.overall })),
      borderColor: COLORS[s.id - 1],
      backgroundColor: COLORS[s.id - 1] + '22',
      tension: 0.3,
      pointRadius: 2,
    };
  }).filter(Boolean);

  carbConfig = {
    type: 'line',
    data: { datasets: carbDatasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
            title: ctx => `Throttle: ${(ctx[0].parsed.x * 100).toFixed(0)}%`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: t('chart.carbX') },
          min: 0,
          max: 1.15,
          ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        },
        y: {
          title: { display: true, text: t('chart.carbY') },
        },
      },
    },
  };

  if (carbChart) carbChart.destroy();
  carbChart = new Chart(document.getElementById('carbChart'), carbConfig);
}

export function openChartModal(which) {
  const config = which === 'needle' ? needleConfig : carbConfig;
  if (!config) return;

  const modal = document.getElementById('chart-modal');
  modal.removeAttribute('hidden');
  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';

  if (modalChart) { modalChart.destroy(); modalChart = null; }

  // Deep-clone config so modal options don't bleed into the source config
  const modalConfig = JSON.parse(JSON.stringify(config));
  // Restore tooltip callbacks lost by JSON serialization
  const srcTooltip = config.options.plugins.tooltip.callbacks;
  modalConfig.options.plugins.tooltip = { callbacks: srcTooltip };
  // Restore ticks callback lost by JSON serialization (both charts use % format)
  if (modalConfig.options.scales.x.ticks) {
    modalConfig.options.scales.x.ticks = {
      callback: v => (v * 100).toFixed(0) + '%',
    };
  }
  modalConfig.options.responsive = true;
  modalConfig.options.maintainAspectRatio = false;
  // On mobile, move legend to bottom to avoid overlapping the chart area
  if (window.innerWidth <= 600) {
    modalConfig.options.plugins.legend = { position: 'bottom' };
  }

  modalChart = new Chart(document.getElementById('modal-canvas'), modalConfig);
}

export function closeChartModal() {
  const modal = document.getElementById('chart-modal');
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
  if (modalChart) { modalChart.destroy(); modalChart = null; }
}
