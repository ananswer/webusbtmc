'use strict';

import Webusbtmc from '../webusbtmc/webusbtmc.js';
import { setupConnectButton, setConnectionState, showMessage, clearMessages, setupHowTo } from '../common/ui.js';
import {
  MEASUREMENTS, profileForVendor, supportedMakers, deviceFilters, parseIdn, formatReading, formatRange, formatDuration, configure, readSettings, readValue,
} from './dmm.js';
import { buildCsv, parseCsv, summarize, fileStamp } from './csv.js';
import { runLogger } from './logger.js';
import { createChart } from './chart.js';
import { WINDOWS, DEFAULT_WINDOW, viewBounds } from './view.js';

// The DMM logger: this file connects the page to the modules.
//   dmm.js     measurements, the number in an answer         csv.js     the file
//   logger.js  the loop with a steady interval               chart.js   the chart

const $ = (id) => document.getElementById(id);

const NPLC_VALUES = [0.02, 0.2, 1, 10, 20, 100];
const INTERVALS = [[500, '0.5 s'], [1000, '1 s'], [2000, '2 s'], [5000, '5 s'], [10000, '10 s'], [30000, '30 s'], [60000, '1 min']];
const SLOT_COUNT = 2;

const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({
  number: i + 1,
  prefix: `dmm${i + 1}-`,
  tmc: new Webusbtmc(),
  device: null,
  idn: null,
  connected: false,
  measurement: 'dcv',
  profile: null,   // how the DMM is told what to do (dmm.js)
  pending: false,  // true while the settings were changed and not applied
  stats: null,     // while logging: { count, min, max, sum }
}));

const chart = createChart($('chart'));
let data = { columns: [], rows: [] };   // what the chart shows, live or from a file
let saved = true;                       // false while there are readings that are not in a file
let running = false;
let controller = null;
let skipped = 0;
let clearArmed = false;
const view = { size: DEFAULT_WINDOW, follow: true, start: 0 };   // the part of the recording that the chart shows

const startButton = $('start-button');
const intervalSelect = $('interval-select');
const saveButton = $('save-button');
const clearButton = $('clear-button');
const openInput = $('open-input');
const windowSelect = $('window-select');
const scrollRange = $('scroll-range');
const liveButton = $('live-button');

// ---------------------------------------------------------------------------------------------
// the cards

function cardHtml(slot) {
  const p = slot.prefix;
  const options = Object.entries(MEASUREMENTS).map(([key, { label }]) => `<option value="${key}">${label}</option>`).join('');
  const tile = (id, label) => `<div class="tile"><small>${label}</small><span id="${p}${id}">—</span></div>`;
  const nplcOptions = ['<option value="">Default</option>', ...NPLC_VALUES.map((value) => `<option value="${value}">${value}</option>`)].join('');
  return `<section class="card-lite dmm${slot.number === 2 ? ' second' : ''}" id="${p}card">
    <div class="head">
      <div class="info">
        <span class="dot" id="${p}conn-dot"></span>
        <div style="min-width: 0">
          <div class="name" id="${p}conn-name">Not connected</div>
          <div class="sub" id="${p}conn-sub"></div>
        </div>
      </div>
      <button class="btn btn-primary" type="button" id="${p}connect-button">Connect</button>
    </div>
    <div class="fields">
      <div>
        <label class="field-label" for="${p}name">Name</label>
        <input class="form-control" id="${p}name" value="DMM ${slot.number}" maxlength="30" autocomplete="off" spellcheck="false">
      </div>
      <div>
        <label class="field-label" for="${p}measurement">Measurement</label>
        <select class="form-select" id="${p}measurement" data-needs-connection disabled>${options}</select>
      </div>
    </div>
    <div class="reading dim" id="${p}reading" aria-live="off">—</div>
    <div class="kv">${tile('min', 'Smallest')}${tile('max', 'Largest')}${tile('mean', 'Mean')}</div>
    <details class="settings" id="${p}settings">
      <summary class="field-label">Advanced settings</summary>
      <div class="fields">
        <div>
          <label class="field-label" for="${p}nplc">Integration time (NPLC)</label>
          <select class="form-select" id="${p}nplc" disabled>${nplcOptions}</select>
        </div>
        <div>
          <label class="field-label" for="${p}range">Range (<span id="${p}range-unit">V</span>)</label>
          <input class="form-control mono" id="${p}range" inputmode="decimal" placeholder="Auto" autocomplete="off" spellcheck="false" disabled>
        </div>
      </div>
      <p class="note mb-1"><b>NPLC</b> is how long the DMM averages one reading, in power line cycles (1 PLC is 20 ms at 50 Hz, 16.7 ms at 60 Hz).
        Fewer cycles are faster and noisier. It is used for DC voltage, DC current and resistance. Not every DMM has it, and each accepts only some values.</p>
      <p class="note mb-2"><b>Range</b> empty is automatic. A fixed range saves the time the DMM needs to change the range, but a reading over the range shows OVLD.
        Some DMMs accept only their own ranges (for example 0.1, 1, 10 or 100 V).</p>
      <div class="row-actions apply-row">
        <button type="button" class="btn btn-outline-secondary" id="${p}apply" disabled>Apply</button>
        <span class="note" id="${p}apply-state" aria-live="polite"></span>
      </div>
      <ul class="apply-result" id="${p}apply-result" aria-live="polite"></ul>
    </details>
  </section>`;
}

const slotName = (slot) => $(`${slot.prefix}name`).value.trim() || `DMM ${slot.number}`;
const symbolOf = (slot) => MEASUREMENTS[slot.measurement].symbol;

function showReading(slot, result) {
  const element = $(`${slot.prefix}reading`);
  if (!result || 'error' in result) {
    element.textContent = '—';
  } else {
    element.textContent = result.value === null ? 'OVLD' : formatReading(result.value, symbolOf(slot));
  }
  element.classList.toggle('dim', !result || 'error' in result);
}

function showStats(slot, summary, symbol = symbolOf(slot)) {
  const text = (value) => (value === null ? '—' : formatReading(value, symbol));
  $(`${slot.prefix}min`).textContent = text(summary.min);
  $(`${slot.prefix}max`).textContent = text(summary.max);
  $(`${slot.prefix}mean`).textContent = text(summary.mean);
}

const noStats = { min: null, max: null, mean: null };

// ---------------------------------------------------------------------------------------------
// the connection of each card

/**
 * The first thing asked of a new instrument is the DC voltage, which every DMM has. An instrument that
 * does not accept it (an oscilloscope of the same maker, for example) is not a DMM and is not connected.
 * Every connection starts with the DC voltage, so the check does not depend on the last choice.
 */
async function checkIsDmm(slot) {
  slot.measurement = 'dcv';
  $(`${slot.prefix}measurement`).value = 'dcv';

  const notDmm = (detail) => Object.assign(new Error(detail), {
    title: 'This instrument is not a DMM.',
    summary: 'It does not understand the commands of a DMM.',
  });
  let result;
  try {
    result = await configure(slot.tmc, 'dcv', {}, slot.profile);
  } catch (error) {
    if (error.name === 'UsbtmcTimeoutError') {
      throw notDmm('It did not answer the commands of a DMM. Choose a DMM.');
    }
    throw error;
  }
  if (!result.ok) {
    throw notDmm(`It does not accept “${MEASUREMENTS.dcv.label}” (${result.errors.join(' ')}). Choose a DMM.`);
  }
}

async function connect(slot, device) {
  // Only the makers that were tried: nothing is sent to an instrument of another maker
  const profile = profileForVendor(device.vendorId);
  if (profile === null) {
    throw Object.assign(new Error(`The DMMs of these makers are supported: ${supportedMakers()}.`), {
      title: 'This DMM is not supported.',
      summary: 'The maker of this instrument has not been tried.',
    });
  }
  await slot.tmc.open(device);
  try {
    slot.idn = parseIdn(await slot.tmc.query('*IDN?'));
    const twin = slots.find((other) => other !== slot && other.connected && other.idn.serial !== '' &&
      other.idn.serial === slot.idn.serial && other.idn.model === slot.idn.model);
    if (twin) {
      throw Object.assign(new Error(`It is connected as “${slotName(twin)}”. Choose the other DMM.`), {
        title: 'This DMM is already connected.',
        summary: 'It is connected in the other card.',
      });
    }
    slot.profile = profile;
    await checkIsDmm(slot);
    resetFields(slot);
  } catch (error) {
    await slot.tmc.close().catch(() => { });
    throw error;
  }
  slot.device = device;
  slot.connected = true;
  showReading(slot, null);
}

// ---------------------------------------------------------------------------------------------
// the settings of each card: what the DMM does with them is shown in the card

/** The range and the integration time in the fields of the card: { range, nplc } or { error }. */
function readFields(slot) {
  const rangeText = $(`${slot.prefix}range`).value.trim();
  const range = rangeText === '' ? null : Number(rangeText);
  if (range !== null && (!Number.isFinite(range) || range <= 0)) {
    return { error: 'The range must be a number above 0, or empty for the automatic range.' };
  }
  const nplcText = $(`${slot.prefix}nplc`).value;
  return { range, nplc: nplcText === '' ? null : Number(nplcText) };
}

/** Back to the defaults: automatic range, the integration time of the DMM. */
function resetFields(slot) {
  $(`${slot.prefix}range`).value = '';
  $(`${slot.prefix}nplc`).value = '';
  $(`${slot.prefix}range-unit`).textContent = symbolOf(slot);
  setPending(slot, false);
  showApplyResult(slot, []);
}

function setPending(slot, pending) {
  slot.pending = pending;
  const apply = $(`${slot.prefix}apply`);
  apply.classList.toggle('btn-primary', pending);
  apply.classList.toggle('btn-outline-secondary', !pending);
  $(`${slot.prefix}apply-state`).textContent = pending ? 'Changed, not applied yet.' : '';
}

/** lines: [{ ok, text }] */
function showApplyResult(slot, lines) {
  const list = $(`${slot.prefix}apply-result`);
  list.replaceChildren(...lines.map((line) => {
    const item = document.createElement('li');
    item.className = line.ok ? 'ok' : 'err';
    const icon = document.createElement('i');
    icon.className = `bi ${line.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`;
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, ' ', line.text);
    return item;
  }));
}

/**
 * Sets the measurement up with the settings of the fields and shows what the DMM accepted.
 * A setting that is not accepted goes back to its default in the field. Returns true when the DMM
 * accepted everything.
 */
async function applySettings(slot) {
  const fields = readFields(slot);
  if (fields.error) {
    showApplyResult(slot, [{ ok: false, text: fields.error }]);
    $(`${slot.prefix}settings`).open = true;
    return false;
  }

  const measurement = MEASUREMENTS[slot.measurement];
  const result = await configure(slot.tmc, slot.measurement, fields, slot.profile);
  const lines = [];
  for (const item of result.results) {
    const what = { measurement: measurement.label, range: `Range ${fields.range === null ? '' : formatRange(fields.range, measurement.symbol)}`, nplc: `NPLC ${fields.nplc}` }[item.setting];
    if (item.skipped) {
      lines.push({ ok: false, text: 'NPLC is not used for this measurement.' });
    } else if (item.ok) {
      if (item.setting !== 'measurement') {
        lines.push({ ok: true, text: `${what} accepted.` });
      }
    } else {
      lines.push({ ok: false, text: `${what} was not accepted by the DMM: ${item.errors.join(' ')}` });
    }
  }

  const failed = (setting) => result.results.some((item) => item.setting === setting && !item.ok);
  if (failed('measurement')) {
    showMessage('warn', `${slotName(slot)} does not accept “${measurement.label}”.`,
      `The DMM answered ${result.results[0].errors.join(' ')} Choose another measurement.`);
  }
  if (failed('range')) {
    $(`${slot.prefix}range`).value = '';
  }
  if (failed('nplc')) {
    $(`${slot.prefix}nplc`).value = '';
  }

  if (!failed('measurement')) {
    try {
      const now = await readSettings(slot.tmc, slot.measurement, { withNplc: fields.nplc !== null && !failed('nplc') }, slot.profile);
      const parts = [];
      if (now.range !== null) {
        parts.push(`range ${formatRange(now.range, measurement.symbol)}${fields.range === null ? ' (automatic)' : ''}`);
      }
      if (now.nplc !== null) {
        parts.push(`NPLC ${now.nplc}`);
      }
      if (parts.length > 0 && lines.length > 0) {
        lines.push({ ok: true, text: `The DMM has now: ${parts.join(', ')}.` });
      }
    } catch (error) {
      // The settings are shown without what the DMM says it has.
    }
  }

  setPending(slot, false);
  showApplyResult(slot, lines);
  if (lines.some((line) => !line.ok) && !failed('measurement')) {
    $(`${slot.prefix}settings`).open = true;
  }
  return result.ok;
}

for (const slot of slots) {
  $('cards').insertAdjacentHTML('beforeend', cardHtml(slot));
}
for (const slot of slots) {
  setupConnectButton({
    prefix: slot.prefix,
    filters: deviceFilters(),
    isOpen: () => slot.connected,
    open: (device) => connect(slot, device),
    close: async () => {
      slot.connected = false;
      await slot.tmc.close();
    },
    onChange: updateControls,
    describe: (device) => ({
      name: slot.idn.model || device.productName || 'DMM',
      detail: slot.idn.serial ? `S/N ${slot.idn.serial}` : 'No serial number',
    }),
  });

  $(`${slot.prefix}measurement`).addEventListener('change', async (event) => {
    slot.measurement = event.target.value;
    showReading(slot, null);
    clearMessages();
    resetFields(slot);
    updateControls();
    try {
      await applySettings(slot);
    } catch (error) {
      showMessage('err', `${slotName(slot)} could not be set.`, error.message);
    }
  });

  for (const field of ['range', 'nplc']) {
    $(`${slot.prefix}${field}`).addEventListener('input', () => setPending(slot, true));
  }
  $(`${slot.prefix}apply`).addEventListener('click', async () => {
    clearMessages();
    try {
      await applySettings(slot);
    } catch (error) {
      showMessage('err', `${slotName(slot)} could not be set.`, error.message);
    }
  });
}

// Unplugging a DMM: the other one goes on, and what was read stays.
navigator.usb.addEventListener('disconnect', (event) => {
  const slot = slots.find((candidate) => candidate.connected && candidate.device === event.device);
  if (!slot) {
    return;
  }
  slot.connected = false;
  slot.tmc.close().catch(() => { });
  setConnectionState('off', {}, slot.prefix);
  showMessage('warn', `${slotName(slot)} was disconnected.`,
    running ? 'The readings of the other DMM go on. Its column stays empty from now on.' : '');
  showReading(slot, null);
  updateControls();
});

// ---------------------------------------------------------------------------------------------
// logging

function setStatus(text) {
  $('status').textContent = text;
}

function statusText() {
  const count = data.rows.length;
  const last = count > 0 ? formatDuration(data.rows[count - 1].elapsed) : '0:00';
  if (running) {
    return `Logging · ${count} readings · ${last}`;
  }
  return count > 0 ? `Stopped · ${count} readings · ${last}` : (slots.some((slot) => slot.connected) ? 'Ready.' : 'Connect a DMM to start.');
}

function showSkipped() {
  const note = $('skip-note');
  note.classList.toggle('d-none', skipped === 0);
  note.textContent = skipped === 0 ? '' :
    `${skipped} reading${skipped === 1 ? ' was' : 's were'} skipped because the DMM needed more time than the interval. Use a longer interval.`;
}

// ---------------------------------------------------------------------------------------------
// which part of the recording the chart shows

function totalTime() {
  const count = data.rows.length;
  return count > 0 ? data.rows[count - 1].elapsed : 0;
}

function updateView() {
  const bounds = viewBounds({ total: totalTime(), size: view.size, start: view.start, follow: view.follow });
  chart.setWindow(bounds.min, bounds.max);
  scrollRange.max = String(bounds.slider.last);
  scrollRange.value = String(bounds.slider.value);
  scrollRange.disabled = bounds.slider.last <= 0;
  const following = running && view.follow && view.size !== null;
  liveButton.disabled = !running || view.size === null;
  liveButton.setAttribute('aria-pressed', String(following));
  liveButton.classList.toggle('btn-primary', following);
  liveButton.classList.toggle('btn-outline-secondary', !following);
}

for (const [seconds, label] of WINDOWS) {
  windowSelect.add(new Option(label, seconds === null ? '' : String(seconds), false, seconds === DEFAULT_WINDOW));
}
windowSelect.addEventListener('change', () => {
  view.size = windowSelect.value === '' ? null : Number(windowSelect.value);
  updateView();
});
scrollRange.addEventListener('input', () => {
  view.follow = false;   // moving the window leaves the newest readings
  view.start = Number(scrollRange.value);
  updateView();
});
liveButton.addEventListener('click', () => {
  view.follow = true;
  updateView();
});

function addRow(row, active) {
  const values = row.results.map((result) => ('value' in result ? result.value : null));
  data.rows.push({ elapsed: row.elapsed, timestamp: row.timestamp, values });
  saved = false;
  clearArmed = false;

  active.forEach((slot, i) => {
    showReading(slot, row.results[i]);
    const value = values[i];
    if (value !== null) {
      const stats = slot.stats;
      stats.count++;
      stats.sum += value;
      stats.min = Math.min(stats.min, value);
      stats.max = Math.max(stats.max, value);
      showStats(slot, { min: stats.min, max: stats.max, mean: stats.sum / stats.count });
    }
  });
  chart.addRow({ elapsed: row.elapsed, values });
  setStatus(statusText());
  updateControls();
}

async function start() {
  const active = slots.filter((slot) => slot.connected);
  if (active.length === 0) {
    return;
  }
  if (data.rows.length > 0 && !saved) {
    showMessage('warn', 'The last readings are not saved.', 'Press Save CSV to keep them, or Clear to throw them away. Then start again.');
    return;
  }

  clearMessages();
  for (const slot of active.filter((candidate) => candidate.pending)) {
    // settings that were changed and not applied are applied first; a DMM that refuses them stops the start
    if (!await applySettings(slot)) {
      showMessage('warn', `The settings of ${slotName(slot)} were not accepted.`, 'See Advanced settings in its card. Logging did not start.');
      return;
    }
  }
  data = { columns: active.map((slot) => ({ name: slotName(slot), unit: MEASUREMENTS[slot.measurement].unit })), rows: [] };
  saved = true;
  skipped = 0;
  showSkipped();
  chart.setRows(data.columns, []);
  view.follow = true;
  view.start = 0;
  $('source-note').textContent = 'Logging. The readings are in this page only: save them as CSV before you leave.';
  for (const slot of slots) {
    slot.stats = { count: 0, min: Infinity, max: -Infinity, sum: 0 };
    showReading(slot, null);
    showStats(slot, noStats);
  }

  const readers = active.map((slot) => ({
    read: () => (slot.connected ? readValue(slot.tmc) : Promise.reject(new Error('Not connected'))),
  }));
  running = true;
  controller = new AbortController();
  setStatus(statusText());
  updateControls();

  try {
    await runLogger({
      readers,
      intervalMs: Number(intervalSelect.value),
      signal: controller.signal,
      onRow: (row) => addRow(row, active),
      onSkip: (count) => {
        skipped += count;
        showSkipped();
      },
    });
  } catch (error) {
    console.error(error);
    showMessage('err', 'Logging stopped.', error.message);
  } finally {
    running = false;
    controller = null;
    if (view.follow) {
      // the window stays where it is when the logging ends, and can be moved
      view.follow = false;
      view.start = Math.max(0, totalTime() - (view.size === null ? 0 : view.size));
    }
    $('source-note').textContent = data.rows.length > 0 ? 'Stopped. Save the readings as CSV to keep them.' : 'The readings appear here.';
    setStatus(statusText());
    updateControls();
  }
}

startButton.addEventListener('click', () => {
  if (running) {
    controller.abort();
    startButton.disabled = true;
    startButton.textContent = 'Stopping…';
  } else {
    start();
  }
});

// ---------------------------------------------------------------------------------------------
// the file

function saveCsv() {
  const text = buildCsv(data.columns, data.rows);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const first = data.rows[0] && data.rows[0].timestamp;
  link.download = `dmmlog_${fileStamp(first ?? Date.now())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  saved = true;
  updateControls();
}

async function openCsv(file) {
  let loaded;
  try {
    loaded = parseCsv(await file.text());
  } catch (error) {
    showMessage('err', 'This file cannot be shown.', error.message);
    return;
  }

  clearMessages();
  const columns = loaded.columns.slice(0, SLOT_COUNT);
  if (loaded.columns.length > SLOT_COUNT) {
    showMessage('warn', `Only the first ${SLOT_COUNT} DMM columns are shown.`, `The file has ${loaded.columns.length}.`);
  }
  data = { columns, rows: loaded.rows.map((row) => ({ ...row, values: row.values.slice(0, SLOT_COUNT) })) };
  saved = true;
  skipped = 0;
  showSkipped();
  chart.setRows(columns, data.rows);
  view.follow = false;
  view.start = 0;

  slots.forEach((slot, i) => {
    showReading(slot, null);
    const column = columns[i];
    const symbol = column ? ({ Ohm: 'Ω' }[column.unit] || column.unit) : '';
    showStats(slot, column ? summarize(data.rows.map((row) => row.values[i])) : noStats, symbol);
  });
  const last = data.rows.length > 0 ? formatDuration(data.rows[data.rows.length - 1].elapsed) : '0:00';
  $('source-note').textContent = `Showing “${file.name}”: ${data.rows.length} readings, ${last}.`;
  setStatus(statusText());
  updateControls();
}

openInput.addEventListener('change', async () => {
  const [file] = openInput.files;
  openInput.value = '';   // the same file can be chosen again
  if (file) {
    await openCsv(file);
  }
});
saveButton.addEventListener('click', saveCsv);

clearButton.addEventListener('click', () => {
  if (!saved && !clearArmed) {
    clearArmed = true;
    showMessage('warn', 'These readings are not saved.', 'Press Clear again to throw them away, or press Save CSV first.');
    return;
  }
  clearArmed = false;
  clearMessages();
  data = { columns: [], rows: [] };
  saved = true;
  skipped = 0;
  showSkipped();
  chart.setRows([], []);
  view.follow = true;
  view.start = 0;
  for (const slot of slots) {
    showReading(slot, null);
    showStats(slot, noStats);
  }
  $('source-note').textContent = 'The readings appear here. Open a CSV file of the logger to look at it without a DMM.';
  setStatus(statusText());
  updateControls();
});

// ---------------------------------------------------------------------------------------------

function updateControls() {
  const anyConnected = slots.some((slot) => slot.connected);
  startButton.disabled = !running && !anyConnected;
  startButton.className = `btn ${running ? 'btn-danger' : 'btn-primary'}`;
  startButton.innerHTML = running ? '<i class="bi bi-stop-fill me-1"></i>Stop' : '<i class="bi bi-play-fill me-1"></i>Start';
  intervalSelect.disabled = running;
  saveButton.disabled = data.rows.length === 0;
  clearButton.disabled = running || (data.rows.length === 0 && data.columns.length === 0);
  $('open-label').classList.toggle('disabled', running);
  openInput.disabled = running;
  for (const slot of slots) {
    $(`${slot.prefix}name`).disabled = running;
    $(`${slot.prefix}measurement`).disabled = running || !slot.connected;
    $(`${slot.prefix}range`).disabled = running || !slot.connected;
    $(`${slot.prefix}nplc`).disabled = running || !slot.connected || !MEASUREMENTS[slot.measurement].nplc;
    $(`${slot.prefix}apply`).disabled = running || !slot.connected;
  }
  if (!running) {
    setStatus(statusText());
  }
  updateView();
}

for (const [milliseconds, label] of INTERVALS) {
  intervalSelect.add(new Option(label, String(milliseconds), false, milliseconds === 1000));
}

// Leaving the page loses the readings and closes the connections, so ask first.
window.addEventListener('beforeunload', (event) => {
  if (running || (data.rows.length > 0 && !saved) || slots.some((slot) => slot.connected)) {
    event.preventDefault();
  }
});

setupHowTo();
updateControls();
