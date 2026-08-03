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

const COLORS_LIGHT = ['#c8102e', '#1b8a4a', '#44494f', '#8c8c8c', '#7a0a1a'];
const COLORS_DARK  = ['#e0454f', '#1f9e58', '#e0b03a', '#7fb3d9', '#a83040'];

export function getColors() {
  return document.body.classList.contains('dark') ? COLORS_DARK : COLORS_LIGHT;
}

// Dashes the portion of a line beyond 100 % throttle (x = 1.0), which is
// extrapolated data absent from the original spreadsheet's tuning range.
function extrapolationSegment(ctx) {
  return ctx.p0.parsed.x >= 1.0 ? [5, 4] : undefined;
}

// Draws a thin marker line at x = 1.0 (100 % throttle) so the boundary
// between real and extrapolated data is visible on both charts.
const throttleBoundaryPlugin = {
  id: 'throttleBoundary',
  beforeDatasetsDraw(chart) {
    const xScale = chart.scales.x;
    if (!xScale) return;
    const x = xScale.getPixelForValue(1.0);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = document.body.classList.contains('dark') ? '#5a6169' : '#c9cdd2';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export function renderCharts(setups, needleSource) {
  const activeSetups = setups.filter(s => s.needleType);
  const colors    = getColors();
  const axisColor = document.body.classList.contains('dark') ? '#9aa0a8' : undefined;

  // --- Needle Profile ---
  // Use the actual throttle-travel range from calcSetup rather than the full needle geometry,
  // so each setup shows only the positions reached during throttle travel (matching Excel).
  const needleDatasets = activeSetups.map(s => {
    const result = calcSetup(s, needleSource);
    if (!result) return null;
    return {
      label: s.name,
      data: result.curve.map(p => ({ x: p.tp, y: p.diam })),
      borderColor: colors[s.id - 1],
      backgroundColor: colors[s.id - 1] + '22',
      tension: 0.3,
      pointRadius: 2,
      segment: { borderDash: extrapolationSegment },
    };
  }).filter(Boolean);

  needleConfig = {
    type: 'line',
    plugins: [throttleBoundaryPlugin],
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
          title: { display: true, text: t('chart.needleX'), color: axisColor },
          min: 0,
          max: 1.15,
          ticks: { callback: v => (v * 100).toFixed(0) + '%', color: axisColor },
        },
        y: {
          title: { display: true, text: t('chart.needleY'), color: axisColor },
          ticks: { color: axisColor },
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
      borderColor: colors[s.id - 1],
      backgroundColor: colors[s.id - 1] + '22',
      tension: 0.3,
      pointRadius: 2,
      segment: { borderDash: extrapolationSegment },
    };
  }).filter(Boolean);

  carbConfig = {
    type: 'line',
    plugins: [throttleBoundaryPlugin],
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
          title: { display: true, text: t('chart.carbX'), color: axisColor },
          min: 0,
          max: 1.15,
          ticks: { callback: v => (v * 100).toFixed(0) + '%', color: axisColor },
        },
        y: {
          title: { display: true, text: t('chart.carbY'), color: axisColor },
          ticks: { color: axisColor },
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
  // Restore the extrapolation-segment callback and boundary-marker plugin,
  // both function-valued and therefore lost by JSON serialization.
  modalConfig.data.datasets.forEach(ds => {
    ds.segment = { borderDash: extrapolationSegment };
  });
  modalConfig.plugins = [throttleBoundaryPlugin];
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
