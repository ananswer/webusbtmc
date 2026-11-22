// Tests of the DMM logger: the readings, the CSV file and the loop. Run with: node --test (in the v2 folder)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEASUREMENTS, STANDARD_SCPI, SUPPORTED_VENDORS, profileForVendor, supportedMakers, deviceFilters, parseReading, parseIdn, parseConfig, formatReading, formatRange, formatDuration, configure, readSettings, readValue,
} from '../dmmlogger/dmm.js';
import { buildCsv, parseCsv, summarize, isoLocal, fileStamp } from '../dmmlogger/csv.js';
import { runLogger } from '../dmmlogger/logger.js';
import { WINDOWS, DEFAULT_WINDOW, viewBounds } from '../dmmlogger/view.js';

// ---------------------------------------------------------------------------------------------
// dmm.js

test('parseReading: numbers, the first of several, overload, no number', () => {
  assert.equal(parseReading('+1.23456E-03\n'), 0.00123456);
  assert.equal(parseReading('-5.0E+00'), -5);
  assert.equal(parseReading('1.5,2.5'), 1.5);
  assert.equal(parseReading('+9.90000000E+37\n'), null);
  assert.equal(parseReading('-9.90000000E+37'), null);
  assert.throws(() => parseReading('abc'), /not a number/);
  assert.throws(() => parseReading(''), /not a number/);
  assert.throws(() => parseReading('NaN'), /not a number/);
});

test('parseIdn', () => {
  assert.deepEqual(parseIdn('AGILENT TECHNOLOGIES,U2741A,MY56190019,1.14-1.08-1.06\n'),
    { maker: 'AGILENT TECHNOLOGIES', model: 'U2741A', serial: 'MY56190019', firmware: '1.14-1.08-1.06' });
  assert.deepEqual(parseIdn('only one'), { maker: 'only one', model: '', serial: '', firmware: '' });
});

test('formatReading: six digits with the prefix that fits', () => {
  assert.equal(formatReading(5.00012, 'V'), '5.00012 V');
  assert.equal(formatReading(0.0234, 'V'), '23.4000 mV');
  assert.equal(formatReading(-0.5, 'V'), '-500.000 mV');
  assert.equal(formatReading(1500, 'Ω'), '1.50000 kΩ');
  assert.equal(formatReading(2.5e-6, 'A'), '2.50000 µA');
  assert.equal(formatReading(0, 'V'), '0.00000 V');
  assert.equal(formatReading(null, 'V'), '—');
});

test('formatRange: the range with a prefix, three digits at most', () => {
  assert.equal(formatRange(0.1, 'V'), '100 mV');
  assert.equal(formatRange(10, 'V'), '10 V');
  assert.equal(formatRange(3, 'V'), '3 V');
  assert.equal(formatRange(10000, 'Ω'), '10 kΩ');
  assert.equal(formatRange(1e-7, 'A'), '100 nA');
  assert.equal(formatRange(0, 'V'), '0 V');
});

test('formatDuration: minutes and seconds, then hours', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(75.9), '1:15');
  assert.equal(formatDuration(3599), '59:59');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(72 * 3600), '72:00:00');
  assert.equal(formatDuration(-3), '0:00');
});

test('every measurement has what the commands need, a label and units', () => {
  for (const [key, measurement] of Object.entries(MEASUREMENTS)) {
    assert.match(measurement.scpi, /^[A-Z]+(:[A-Z]+)?$/, key);
    assert.equal(typeof measurement.nplc, 'boolean', key);
    assert.ok(measurement.label && measurement.unit && measurement.symbol, key);
    assert.match(measurement.unit, /^[\x20-\x7e]+$/, `${key}: the unit of the file is ASCII`);
  }
});

test('the standard commands: the measurement, the range and the integration time', () => {
  const p = STANDARD_SCPI;
  assert.equal(p.configure(MEASUREMENTS.dcv), 'CONF:VOLT:DC AUTO');
  assert.equal(p.configure(MEASUREMENTS.dcv, 10), 'CONF:VOLT:DC 10');
  assert.equal(p.configure(MEASUREMENTS.res, 1e4), 'CONF:RES 10000');
  assert.equal(p.configure(MEASUREMENTS.freq), 'CONF:FREQ');   // no argument for the automatic range
  assert.equal(p.configure(MEASUREMENTS.cap), 'CONF:CAP');
  assert.equal(p.nplc(MEASUREMENTS.dci, 10), 'CURR:DC:NPLC 10');
  assert.equal(p.nplcQuery(MEASUREMENTS.dcv), 'VOLT:DC:NPLC?');
});

test('NPLC is for DC voltage, DC current and resistance only', () => {
  assert.deepEqual(Object.entries(MEASUREMENTS).filter(([, m]) => m.nplc).map(([key]) => key), ['dcv', 'dci', 'res']);
});

test('only the makers that were tried are supported, by the USB vendor ID', () => {
  assert.equal(profileForVendor(0x0957), STANDARD_SCPI);   // Keysight (Agilent)
  assert.equal(profileForVendor(0x0699), null);            // Tektronix
  assert.equal(profileForVendor(0x1AB1), null);            // Rigol
  assert.equal(profileForVendor(undefined), null);
  assert.equal(supportedMakers(), 'Keysight (Agilent)');
});

test('the dialog of the browser offers the USBTMC instruments of the supported makers only', () => {
  assert.deepEqual(deviceFilters(), [{ vendorId: 0x0957, classCode: 0xFE, subclassCode: 0x03, protocolCode: 0x01 }]);
});

test('a maker that is added to the table is offered and has its profile', () => {
  const vendorId = 0xABCD;
  const profile = { ...STANDARD_SCPI, name: 'Another maker' };
  SUPPORTED_VENDORS[vendorId] = { name: 'Another maker', profile };
  try {
    assert.equal(profileForVendor(vendorId), profile);
    assert.deepEqual(deviceFilters().map((filter) => filter.vendorId), [0x0957, vendorId]);
    assert.equal(supportedMakers(), 'Keysight (Agilent), Another maker');
  } finally {
    delete SUPPORTED_VENDORS[vendorId];
  }
  assert.equal(profileForVendor(vendorId), null);
});

test('parseConfig reads the range and the resolution', () => {
  assert.deepEqual(parseConfig('"VOLT +1.00000E+01,+1.50000E-06"\n'), { function: 'VOLT', range: 10, resolution: 1.5e-6 });
  assert.deepEqual(parseConfig('"RES +1.00000E+04,+1.5E-06"'), { function: 'RES', range: 10000, resolution: 1.5e-6 });
  assert.deepEqual(parseConfig('"CURR:DC +1.00000E-01,+1.00000E-07"'), { function: 'CURR:DC', range: 0.1, resolution: 1e-7 });
  assert.equal(parseConfig('nonsense'), null);
  assert.equal(parseConfig(''), null);
});

class FakeInstrument {
  constructor({ rejects = [] } = {}) {
    this.sent = [];
    this.errors = [];
    this.rejects = rejects;   // the commands that make an error
    this.answer = '+1.0E+00\n';
    this.answers = {};        // answers to other queries
  }
  async write(text) {
    this.sent.push(text);
    if (text === '*CLS') {
      this.errors = [];
    } else if (this.rejects.includes(text)) {
      this.errors.push(this.rejectWith ?? '-113,"Undefined header"');
    }
  }
  async query(text, length, timeout) {
    this.sent.push(text);
    this.lastTimeout = timeout;
    if (text === 'SYST:ERR?') {
      return (this.errors.shift() ?? '+0,"No error"') + '\n';
    }
    return this.answers[text] ?? this.answer;
  }
}

test('configure: clears the errors, sets the measurement up and checks the error queue', async () => {
  const instrument = new FakeInstrument();
  const result = await configure(instrument, 'dcv');
  assert.equal(result.ok, true);
  assert.deepEqual(result.results, [{ setting: 'measurement', command: 'CONF:VOLT:DC AUTO', ok: true, errors: [] }]);
  assert.deepEqual(instrument.sent, ['*CLS', 'CONF:VOLT:DC AUTO', 'SYST:ERR?']);
});

test('configure: a range and an integration time are sent one by one, after the measurement', async () => {
  const instrument = new FakeInstrument();
  const result = await configure(instrument, 'dcv', { range: 10, nplc: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(instrument.sent, [
    '*CLS',
    'CONF:VOLT:DC AUTO', 'SYST:ERR?',
    'CONF:VOLT:DC 10', 'SYST:ERR?',
    'VOLT:DC:NPLC 1', 'SYST:ERR?',
  ]);
  assert.deepEqual(result.results.map((r) => r.setting), ['measurement', 'range', 'nplc']);
});

test('configure: the answer tells which setting the DMM did not accept', async () => {
  const instrument = new FakeInstrument({ rejects: ['CONF:VOLT:DC 3'] });
  instrument.rejectWith = '-224,"Illegal parameter value"';
  const result = await configure(instrument, 'dcv', { range: 3, nplc: 10 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.results.map((r) => r.ok), [true, false, true]);   // the integration time is still sent
  assert.deepEqual(result.results[1].errors, ['-224,"Illegal parameter value"']);
  assert.deepEqual(result.errors, ['-224,"Illegal parameter value"']);
});

test('configure: a DMM without NPLC reports the error of its command', async () => {
  const instrument = new FakeInstrument({ rejects: ['VOLT:DC:NPLC 10'] });
  const result = await configure(instrument, 'dcv', { nplc: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.results[1].setting, 'nplc');
  assert.deepEqual(result.results[1].errors, ['-113,"Undefined header"']);
});

test('configure: NPLC for a measurement that has none is skipped, not sent', async () => {
  const instrument = new FakeInstrument();
  const result = await configure(instrument, 'acv', { nplc: 10 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.results[1], { setting: 'nplc', command: null, ok: false, skipped: true, errors: [] });
  assert.ok(!instrument.sent.some((command) => command.includes('NPLC')));
});

test('configure: an instrument that does not accept the measurement', async () => {
  const instrument = new FakeInstrument({ rejects: ['CONF:CAP'] });
  const result = await configure(instrument, 'cap');
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['-113,"Undefined header"']);
  await assert.rejects(() => configure(instrument, 'nothing'), /Unknown measurement/);
});

test('configure: a profile of another maker is used for the commands', async () => {
  const profile = {
    ...STANDARD_SCPI,
    clear: 'CLS',
    configure: (measurement, range) => `:FUNC ${measurement.scpi}${range === null ? '' : ' ' + range}`,
    nplc: (measurement, value) => `:RATE ${value}`,
  };
  const instrument = new FakeInstrument();
  await configure(instrument, 'dcv', { range: 5, nplc: 2 }, profile);
  assert.deepEqual(instrument.sent.filter((command) => command !== 'SYST:ERR?'), ['CLS', ':FUNC VOLT:DC', ':FUNC VOLT:DC 5', ':RATE 2']);
});

test('readSettings: the range from CONF?, the integration time only when asked', async () => {
  const instrument = new FakeInstrument();
  instrument.answers['CONF?'] = '"VOLT +1.00000E+01,+1.50000E-06"\n';
  instrument.answers['VOLT:DC:NPLC?'] = '+1.00000000E+00\n';
  assert.deepEqual(await readSettings(instrument, 'dcv'), { range: 10, resolution: 1.5e-6, nplc: null });
  assert.ok(!instrument.sent.includes('VOLT:DC:NPLC?'));
  assert.deepEqual(await readSettings(instrument, 'dcv', { withNplc: true }), { range: 10, resolution: 1.5e-6, nplc: 1 });
  assert.deepEqual(await readSettings(instrument, 'acv', { withNplc: true }), { range: 10, resolution: 1.5e-6, nplc: null });   // no NPLC to ask for
});

test('readValue asks READ? with the timeout and parses the answer', async () => {
  const instrument = new FakeInstrument();
  instrument.answer = '+2.5E-03\n';
  assert.equal(await readValue(instrument, 7000), 0.0025);
  assert.equal(instrument.lastTimeout, 7000);
  instrument.answer = '+9.9E+37\n';
  assert.equal(await readValue(instrument), null);
});

// ---------------------------------------------------------------------------------------------
// csv.js

test('isoLocal can be read back', () => {
  for (const milliseconds of [0, 1761207330123, 1750000000999, Date.UTC(2026, 11, 31, 23, 59, 59, 5)]) {
    const text = isoLocal(milliseconds);
    assert.match(text, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    assert.equal(Date.parse(text), milliseconds);
  }
});

test('fileStamp is the local time without separators', () => {
  const stamp = fileStamp(1761207330123);
  assert.match(stamp, /^\d{8}-\d{6}$/);
  const date = new Date(1761207330123);
  assert.equal(stamp.slice(0, 4), String(date.getFullYear()));
  assert.equal(stamp.slice(9, 11), String(date.getHours()).padStart(2, '0'));
});

const columns = [{ name: 'Supply', unit: 'V' }, { name: 'Load', unit: 'A' }];
const rows = [
  { elapsed: 0, timestamp: 1761207330123, values: [5.00012, 0.20031] },
  { elapsed: 1, timestamp: 1761207331124, values: [5.0001, null] },
  { elapsed: 2.5, timestamp: 1761207332630, values: [null, 0.2] },
];

test('buildCsv: the header and the lines', () => {
  const lines = buildCsv(columns, rows).split('\n');
  assert.equal(lines[0], 'Time (s),Date and time,Supply (V),Load (A)');
  assert.equal(lines[1], `0.000,${isoLocal(1761207330123)},5.00012,0.20031`);
  assert.equal(lines[2], `1.000,${isoLocal(1761207331124)},5.0001,`);
  assert.equal(lines[3], `2.500,${isoLocal(1761207332630)},,0.2`);
  assert.equal(lines[4], '');
});

test('what is saved is read again, with empty cells as null', () => {
  const loaded = parseCsv(buildCsv(columns, rows));
  assert.deepEqual(loaded.columns, columns);
  assert.equal(loaded.rows.length, 3);
  assert.deepEqual(loaded.rows.map((row) => row.values), rows.map((row) => row.values));
  assert.deepEqual(loaded.rows.map((row) => row.elapsed), [0, 1, 2.5]);
  assert.deepEqual(loaded.rows.map((row) => row.timestamp), rows.map((row) => row.timestamp));
});

test('names with commas, quotes and non-ASCII letters survive', () => {
  const odd = [{ name: 'Supply, "main"', unit: 'V' }, { name: '電源 (B)', unit: 'Ohm' }];
  const loaded = parseCsv(buildCsv(odd, [{ elapsed: 0, timestamp: 0, values: [1, 2] }]));
  assert.deepEqual(loaded.columns, odd);
});

test('parseCsv: a byte order mark, Windows line breaks, no clock column, bad lines', () => {
  const text = '﻿Time (s),Supply (V)\r\n0,1.5\r\n\r\nnot a number,2\r\n1,2.5\r\n2,abc\r\n';
  const loaded = parseCsv(text);
  assert.deepEqual(loaded.columns, [{ name: 'Supply', unit: 'V' }]);
  assert.deepEqual(loaded.rows.map((row) => row.elapsed), [0, 1, 2]);
  assert.deepEqual(loaded.rows.map((row) => row.values[0]), [1.5, 2.5, null]);
  assert.equal(loaded.rows[0].timestamp, null);
});

test('parseCsv: a column without a unit, columns in another order', () => {
  const loaded = parseCsv('Voltage,Date and time,Time (s)\n1.5,,3\n');
  assert.deepEqual(loaded.columns, [{ name: 'Voltage', unit: '' }]);
  assert.equal(loaded.rows[0].elapsed, 3);
  assert.deepEqual(loaded.rows[0].values, [1.5]);
});

test('parseCsv: files that are not from the logger', () => {
  assert.throws(() => parseCsv(''), /empty/);
  assert.throws(() => parseCsv('a,b\n1,2\n'), /“Time \(s\)” column/);
  assert.throws(() => parseCsv('Time (s),Date and time\n0,2026-01-01\n'), /no column with readings/);
});

test('summarize: count, smallest, largest and mean, without the empty ones', () => {
  assert.deepEqual(summarize([1, null, 3, 2]), { count: 3, min: 1, max: 3, mean: 2 });
  assert.deepEqual(summarize([null, null]), { count: 0, min: null, max: null, mean: null });
  assert.deepEqual(summarize([]), { count: 0, min: null, max: null, mean: null });
  // a log of three days at 0.5 seconds has half a million readings
  assert.equal(summarize(Array.from({ length: 600000 }, (_, i) => i)).max, 599999);
});

// ---------------------------------------------------------------------------------------------
// logger.js, with a clock that only moves when everything waits

class VirtualClock {
  constructor() {
    this.time = 0;
    this.timers = [];
  }
  now = () => this.time;
  sleep = (ms, signal) => new Promise((resolve) => {
    if (signal && signal.aborted) {
      resolve();
      return;
    }
    const timer = { at: this.time + ms, resolve };
    this.timers.push(timer);
    signal && signal.addEventListener('abort', () => {
      this.timers = this.timers.filter((t) => t !== timer);
      resolve();
    }, { once: true });
  });
  async runUntil(isDone) {
    for (;;) {
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setImmediate(resolve));   // let the promises run
      }
      if (isDone() || this.timers.length === 0) {
        return;
      }
      this.timers.sort((a, b) => a.at - b.at);
      const timer = this.timers.shift();
      this.time = Math.max(this.time, timer.at);
      timer.resolve();
    }
  }
}

/** Runs the logger until `count` rows are there. */
async function logRows({ readers, intervalMs, count, clock = new VirtualClock() }) {
  const controller = new AbortController();
  const rows = [];
  const skips = [];
  let summary = null;
  const done = runLogger({
    readers, intervalMs, signal: controller.signal, now: clock.now, wallClock: () => 1000000, sleep: clock.sleep,
    onRow: (row) => { rows.push(row); if (rows.length >= count) controller.abort(); },
    onSkip: (n) => skips.push(n),
  }).then((result) => { summary = result; });
  await clock.runUntil(() => summary !== null);
  await done;
  return { rows, skips, summary, clock };
}

const reader = (clock, duration, value) => ({ read: async () => { await clock.sleep(duration); return typeof value === 'function' ? value() : value; } });

test('logger: one row per interval with the readings of all instruments', async () => {
  const clock = new VirtualClock();
  let n = 0;
  const { rows, skips, summary } = await logRows({
    clock, intervalMs: 1000, count: 5,
    readers: [reader(clock, 100, () => n++), reader(clock, 250, 7)],
  });
  assert.deepEqual(rows.map((row) => row.elapsed), [0, 1, 2, 3, 4]);
  assert.deepEqual(rows.map((row) => row.results[0].value), [0, 1, 2, 3, 4]);
  assert.ok(rows.every((row) => row.results[1].value === 7));
  assert.deepEqual(rows.map((row) => row.timestamp), [1000000, 1001000, 1002000, 1003000, 1004000]);
  assert.deepEqual(rows.map((row) => row.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(skips, []);
  assert.deepEqual(summary, { cycles: 5, skipped: 0 });
});

test('logger: the interval does not grow with the time of a reading', async () => {
  const clock = new VirtualClock();
  const { rows } = await logRows({ clock, intervalMs: 500, count: 6, readers: [reader(clock, 400, 1)] });
  assert.deepEqual(rows.map((row) => row.elapsed), [0, 0.5, 1, 1.5, 2, 2.5]);
});

test('logger: a reading that takes exactly the interval skips nothing', async () => {
  const clock = new VirtualClock();
  const { rows, skips } = await logRows({ clock, intervalMs: 1000, count: 4, readers: [reader(clock, 1000, 1)] });
  assert.deepEqual(rows.map((row) => row.elapsed), [0, 1, 2, 3]);
  assert.deepEqual(skips, []);
});

test('logger: an instrument that fails does not stop the others', async () => {
  const clock = new VirtualClock();
  const broken = { read: async () => { await clock.sleep(10); throw new Error('no answer'); } };
  const { rows } = await logRows({ clock, intervalMs: 1000, count: 3, readers: [reader(clock, 10, 2.5), broken] });
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.deepEqual(row.results[0], { value: 2.5 });
    assert.equal(row.results[1].error.message, 'no answer');
    assert.ok(!('value' in row.results[1]));
  }
});

test('logger: an overload is a value of null, not an error', async () => {
  const clock = new VirtualClock();
  const { rows } = await logRows({ clock, intervalMs: 1000, count: 1, readers: [reader(clock, 10, null)] });
  assert.deepEqual(rows[0].results[0], { value: null });
});

test('logger: instruments that are too slow skip readings and are never asked twice at once', async () => {
  const clock = new VirtualClock();
  let busy = 0;
  let overlapped = false;
  const slow = {
    read: async () => {
      busy++;
      overlapped = overlapped || busy > 1;
      await clock.sleep(1500);
      busy--;
      return 1;
    },
  };
  const { rows, skips } = await logRows({ clock, intervalMs: 1000, count: 3, readers: [slow] });
  assert.deepEqual(rows.map((row) => row.elapsed), [0, 2, 4]);
  assert.deepEqual(skips.slice(0, 2), [1, 1]);
  assert.equal(overlapped, false);
});

test('logger: one slow reading at the start (auto range) only skips what it took', async () => {
  const clock = new VirtualClock();
  let calls = 0;
  const { rows, skips } = await logRows({ clock, intervalMs: 1000, count: 3, readers: [{ read: async () => { await clock.sleep(calls++ === 0 ? 2000 : 100); return 1; } }] });
  assert.deepEqual(rows.map((row) => row.elapsed), [0, 2, 3]);
  assert.deepEqual(skips, [1]);
});

test('logger: stopping while it waits ends at once', async () => {
  const clock = new VirtualClock();
  const { rows, summary } = await logRows({ clock, intervalMs: 600000, count: 1, readers: [reader(clock, 10, 1)] });
  assert.equal(rows.length, 1);
  assert.equal(summary.cycles, 1);
  assert.ok(clock.time < 1000, `the clock moved to ${clock.time}`);
});

test('logger: an aborted signal before the start reads nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const rows = [];
  const summary = await runLogger({ readers: [{ read: async () => 1 }], intervalMs: 1000, signal: controller.signal, onRow: (row) => rows.push(row) });
  assert.deepEqual(summary, { cycles: 0, skipped: 0 });
  assert.equal(rows.length, 0);
});

test('logger: with the real clock', async () => {
  const controller = new AbortController();
  const rows = [];
  await runLogger({
    readers: [{ read: async () => 1 }], intervalMs: 20, signal: controller.signal,
    onRow: (row) => { rows.push(row); if (rows.length === 4) controller.abort(); },
  });
  assert.equal(rows.length, 4);
  assert.ok(rows[3].elapsed >= 0.05 && rows[3].elapsed < 0.5, `elapsed ${rows[3].elapsed}`);
});

// ---------------------------------------------------------------------------------------------
// view.js: the window of the chart

test('windows: from short to long, the whole recording last, the default is one of them', () => {
  const sizes = WINDOWS.map(([seconds]) => seconds);
  assert.equal(sizes.at(-1), null);
  assert.deepEqual(sizes.slice(0, -1), [...sizes.slice(0, -1)].sort((a, b) => a - b));
  assert.ok(sizes.includes(DEFAULT_WINDOW));
  assert.equal(DEFAULT_WINDOW, 60);
});

test('viewBounds: following a recording that is shorter than the window keeps the axis as long as the window', () => {
  assert.deepEqual(viewBounds({ total: 20, size: 60, follow: true }), { min: 0, max: 60, slider: { last: 0, value: 0 } });
  assert.deepEqual(viewBounds({ total: 0, size: 60, follow: true }), { min: 0, max: 60, slider: { last: 0, value: 0 } });
  assert.deepEqual(viewBounds({ total: 60, size: 60, follow: true }), { min: 0, max: 60, slider: { last: 0, value: 0 } });
});

test('viewBounds: following a long recording ends at the newest reading', () => {
  assert.deepEqual(viewBounds({ total: 500, size: 60, follow: true }), { min: 440, max: 500, slider: { last: 440, value: 440 } });
  assert.deepEqual(viewBounds({ total: 501.5, size: 60, start: 3, follow: true }).min, 441.5);   // the start is ignored
});

test('viewBounds: not following keeps the start, inside the recording', () => {
  assert.deepEqual(viewBounds({ total: 500, size: 60, start: 100 }), { min: 100, max: 160, slider: { last: 440, value: 100 } });
  assert.equal(viewBounds({ total: 500, size: 60, start: 100 }).min, viewBounds({ total: 900, size: 60, start: 100 }).min);   // it stays when more comes
  assert.equal(viewBounds({ total: 500, size: 60, start: 9999 }).min, 440);
  assert.equal(viewBounds({ total: 500, size: 60, start: -5 }).min, 0);
  assert.equal(viewBounds({ total: 30, size: 60, start: 10 }).min, 0);
});

test('viewBounds: the whole recording, with nothing to scroll', () => {
  assert.deepEqual(viewBounds({ total: 300, size: null, follow: true }), { min: 0, max: 300, slider: { last: 0, value: 0 } });
  assert.deepEqual(viewBounds({ total: 0, size: null }), { min: 0, max: 1, slider: { last: 0, value: 0 } });
});
