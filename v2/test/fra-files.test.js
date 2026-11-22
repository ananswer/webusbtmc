// Tests of the text and the files of the frequency response page. Run with: node --test (in the v2 folder)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  processBodeData, createLTspiceSubcktContent, createBodeCSVContent, createBodeTSVContent,
  createCSVContent, createTSVContent, parseBodePlotData,
} from '../fra/bodeData.js';
import { CAPTURE_PROBLEMS, analysisProblem, formatFrequency } from '../fra/measurementText.js';

const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

// ---------------------------------------------------------------------------------------------
// processBodeData: sort by frequency, average the points of the same frequency (whole Hz)

test('processBodeData sorts by frequency', () => {
  const result = processBodeData([300, 100, 200], [-3, -1, -2], [-30, -10, -20]);
  assert.deepEqual(result, { frequencies: [100, 200, 300], magnitudes: [-1, -2, -3], phases: [-10, -20, -30] });
});

test('processBodeData averages points of the same frequency', () => {
  const result = processBodeData([100.2, 100.9, 200], [-1, -3, -5], [-10, -30, -50]);
  assert.deepEqual(result.frequencies, [100, 200]);
  assert.deepEqual(result.magnitudes, [-2, -5]);
  assert.deepEqual(result.phases, [-20, -50]);
});

// ---------------------------------------------------------------------------------------------
// the files that are saved and loaded

const sample = { frequencies: [100, 1000, 10000], magnitudes: [-0.1, -3, -20], phases: [-5, -45, -85] };

test('CSV of the plot data, in Hz and in rad/s', () => {
  assert.equal(createBodeCSVContent(sample, 'Hz'),
    'Frequency (Hz),Magnitude (dB),Phase (degrees)\n100,-0.1,-5\n1000,-3,-45\n10000,-20,-85\n');
  const rad = createBodeCSVContent(sample, 'rad/s').split('\n');
  assert.equal(rad[0], 'Frequency (rad/s),Magnitude (dB),Phase (degrees)');
  near(parseFloat(rad[2].split(',')[0]), 1000 * 2 * Math.PI, 1e-9);
});

test('TSV of the plot data', () => {
  assert.equal(createBodeTSVContent(sample), 'Frequency\tMagnitude\tPhase\n100\t-0.1\t-5\n1000\t-3\t-45\n10000\t-20\t-85\n');
});

test('what is saved can be loaded again (CSV in Hz, CSV in rad/s, TSV)', () => {
  const hz = parseBodePlotData(createBodeCSVContent(sample, 'Hz'));
  assert.equal(hz.unit, 'Hz');
  assert.deepEqual(hz.frequencies, sample.frequencies);
  assert.deepEqual(hz.magnitudes, sample.magnitudes);
  assert.deepEqual(hz.phases, sample.phases);

  const rad = parseBodePlotData(createBodeCSVContent(sample, 'rad/s'));
  assert.equal(rad.unit, 'rad/s');
  rad.frequencies.forEach((f, i) => near(f, sample.frequencies[i], 1e-9));   // loaded back in Hz

  const tsv = parseBodePlotData(createBodeTSVContent(sample));
  assert.deepEqual(tsv.frequencies, sample.frequencies);
  assert.deepEqual(tsv.phases, sample.phases);
});

test('loading ignores lines that are not numbers', () => {
  const loaded = parseBodePlotData('Frequency (Hz),Magnitude (dB),Phase (degrees)\n100,-1,-5\nnot,a,number\n\n200,-2,-10\n');
  assert.deepEqual(loaded.frequencies, [100, 200]);
});

test('LTspice subcircuit', () => {
  const text = createLTspiceSubcktContent({ frequencies: [100], magnitudes: [-3], phases: [-45] }, 'bode_plot_data001');
  const lines = text.split('\n');
  assert.equal(lines[0], '.subckt bode_plot_data001 1 2');
  assert.equal(lines[1], 'E 2 0 FREQ {V(1,0)} =');
  assert.match(lines[2], /^\+\(1\.00000000000000e\+2,-3\.00000000000000e\+0,-4\.50000000000000e\+1\)$/);
  assert.equal(lines[3], '.ends');
});

test('waveforms as CSV and TSV', () => {
  assert.equal(createCSVContent([0, 1e-6], [1, 2], [3, 4], [5, 6], [7, 8]),
    'Time(s),Ch1_raw,Ch1_filtered,Ch2_raw,Ch2_filtered\n0,1,3,5,7\n0.000001,2,4,6,8\n');
  assert.equal(createTSVContent([0], [1], [3], [5], [7]),
    'Time\tCh1_raw\tCh1_filtered\tCh2_raw\tCh2_filtered\n0\t1\t3\t5\t7\n');
});

// ---------------------------------------------------------------------------------------------
// what the page tells the user

test('formatFrequency: four digits with a prefix', () => {
  assert.equal(formatFrequency(1600.1, 'Hz'), '1.600 kHz');
  assert.equal(formatFrequency(399.99, 'Hz'), '400.0 Hz');
  assert.equal(formatFrequency(10000, 'Hz'), '10.00 kHz');
  assert.equal(formatFrequency(2.5e6, 'Hz'), '2.500 MHz');
  assert.equal(formatFrequency(10000, 'rad/s'), '62.83 krad/s');
});

test('analysisProblem: a good measurement has no problem', () => {
  assert.equal(analysisProblem({ freq: 1600, gain: 0.7, periodCount: 15, periodSpread: 0.03 }), null);
});

test('analysisProblem: no frequency, noise, no signal in CH2', () => {
  assert.match(analysisProblem({ freq: Infinity, gain: NaN, periodCount: 0, periodSpread: Infinity })[0], /frequency of CH1/);
  assert.match(analysisProblem({ freq: 25000, gain: 0.9, periodCount: 248, periodSpread: 3 })[0], /too small or not a steady sine/);
  assert.match(analysisProblem({ freq: 1600, gain: 0, periodCount: 15, periodSpread: 0.03 })[0], /CH2 shows no signal/);
});

test('analysisProblem: with only a few periods the spread does not count', () => {
  assert.equal(analysisProblem({ freq: 400, gain: 0.5, periodCount: 2, periodSpread: 0.9 }), null);
});

test('every reason a fetch can fail has a text', () => {
  for (const reason of ['no-waveform', 'format-changed', 'length-mismatch']) {
    assert.equal(CAPTURE_PROBLEMS[reason].length, 2, reason);
  }
});
