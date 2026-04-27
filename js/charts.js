// charts.js — Chart.js diagram rendering
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { calcSetup, calcNeedleProfile } from './calc.js';

let needleChart = null;
let carbChart   = null;

export const COLORS = ['#2e8b7a', '#e07b39', '#6a5acd', '#c0392b', '#27ae60'];

export function renderCharts(setups, needleSource) {
  const activeSetups = setups.filter(s => s.needleType);

  // --- Needle Profile ---
  const needleDatasets = activeSetups.map(s => ({
    label: s.name,
    data: calcNeedleProfile(s.needleType, needleSource).map(p => ({ x: p.pos, y: p.diam })),
    borderColor: COLORS[s.id - 1],
    backgroundColor: COLORS[s.id - 1] + '22',
    tension: 0.3,
    pointRadius: 0,
  }));

  if (needleChart) needleChart.destroy();
  needleChart = new Chart(document.getElementById('needleChart'), {
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
          title: { display: true, text: 'Needle position (mm)' },
        },
        y: {
          title: { display: true, text: 'Needle diameter (mm)' },
        },
      },
    },
  });

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

  if (carbChart) carbChart.destroy();
  carbChart = new Chart(document.getElementById('carbChart'), {
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
          title: { display: true, text: 'Throttle position' },
          min: 0,
          max: 1.15,
          ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        },
        y: {
          title: { display: true, text: 'Equivalent HD' },
        },
      },
    },
  });
}
