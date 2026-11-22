// The chart of the logger: up to two readings against the time, each with its own axis and the
// colour of its card. Chart.js is loaded by a script tag of the page.
'use strict';

import { formatDuration } from './dmm.js';

const SLOTS = 2;

export function createChart(canvas) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: Array.from({ length: SLOTS }, (_, i) => ({
        label: '',
        data: [],
        yAxisID: i === 0 ? 'y1' : 'y2',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true,
        normalized: true,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,   // the points are already { x, y }
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: {
          display: false,   // shown when there are columns
          labels: { filter: (item, data) => data.datasets[item.datasetIndex].label !== '' },   // no box for a column that is not there
        },
        decimation: { enabled: true, algorithm: 'min-max' },   // many readings: draw the smallest and the largest of each part
        tooltip: {
          callbacks: {
            title: (items) => formatDuration(items[0].parsed.x),
            label: (item) => `${item.dataset.label}: ${item.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Time from the start' },
          ticks: { callback: (value) => formatDuration(value) },
        },
        y1: { type: 'linear', position: 'left', grace: '5%', title: { display: true, text: '' } },
        y2: { type: 'linear', position: 'right', grace: '5%', display: false, grid: { drawOnChartArea: false }, title: { display: true, text: '' } },
      },
    },
  });

  function applyTheme() {
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--muted').trim();
    const line = css.getPropertyValue('--line').trim();
    const colors = [css.getPropertyValue('--ch1').trim(), css.getPropertyValue('--ch2').trim()];

    chart.options.plugins.legend.labels.color = css.getPropertyValue('--fg').trim();
    const x = chart.options.scales.x;
    x.ticks.color = text;
    x.title.color = text;
    x.grid.color = line;
    ['y1', 'y2'].forEach((axis, i) => {
      const scale = chart.options.scales[axis];
      scale.ticks.color = colors[i];
      scale.title.color = colors[i];
      scale.grid.color = line;
      chart.data.datasets[i].borderColor = colors[i];
      chart.data.datasets[i].backgroundColor = colors[i];
    });
    chart.update('none');
  }
  window.addEventListener('tmc-themechange', applyTheme);
  applyTheme();

  return {
    /** Replaces everything. columns: [{ name, unit }], rows as of csv.js. */
    setRows(columns, rows) {
      chart.data.datasets.forEach((dataset, i) => {
        dataset.data = rows.filter((row) => row.values[i] !== null && row.values[i] !== undefined).map((row) => ({ x: row.elapsed, y: row.values[i] }));
        dataset.label = columns[i] ? `${columns[i].name} (${columns[i].unit})` : '';
        dataset.hidden = !columns[i];
      });
      columns.slice(0, SLOTS).forEach((column, i) => {
        chart.options.scales[i === 0 ? 'y1' : 'y2'].title.text = `${column.name} (${column.unit})`;
      });
      chart.options.scales.y2.display = columns.length > 1;
      chart.options.plugins.legend.display = columns.length > 0;
      chart.update('none');
    },

    /**
     * Adds one row (a reading that is empty is left out; the line goes on over it).
     * The chart is drawn by the next setWindow().
     */
    addRow(row) {
      row.values.forEach((value, i) => {
        if (value !== null && value !== undefined && chart.data.datasets[i]) {
          chart.data.datasets[i].data.push({ x: row.elapsed, y: value });
        }
      });
    },

    /** Shows the part from `min` to `max` seconds. The vertical axes follow what is in it. */
    setWindow(min, max) {
      chart.options.scales.x.min = min;
      chart.options.scales.x.max = max;
      chart.update('none');
    },
  };
}
