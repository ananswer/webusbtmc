// Tests of the frequency response analysis with synthetic waves. Run with: node --test (in the v2 folder)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPhaseDifference } from '../fra/analysis.js';
import { lpf1stOrder, build_xy } from '../fra/preprocess.js';

const TS = 1e-5;     // 10 us per sample, like 1 ms/div with 1000 points
const N = 1000;
const DEG = Math.PI / 180;

const sine = (freq, amplitude, phase, offset = 0) =>
  Array.from({ length: N }, (_, i) => offset + amplitude * Math.sin(2 * Math.PI * freq * i * TS + phase));

// Same numbers every run.
function random(seed) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

// The phase resolution is one sample: 360 * freq * TS degrees.
test('a sine wave: frequency, gain and phase (B lags A)', () => {
  for (const [freq, tolerance] of [[400, 2], [800, 2], [1600, 3], [3200, 6]]) {
    for (const lag of [0, 30, 60]) {
      const result = findPhaseDifference(sine(freq, 1, 0), sine(freq, 0.5, -lag * DEG), TS);
      near(result.freq / freq, 1, 0.02, `frequency at ${freq} Hz`);
      near(result.gain, 0.5, 0.01, `gain at ${freq} Hz`);
      near(result.phase_rad / DEG, -lag, tolerance, `phase at ${freq} Hz, lag ${lag}`);
    }
  }
});

test('a sine wave: B leads A gives a positive phase', () => {
  const result = findPhaseDifference(sine(1600, 1, 0), sine(1600, 1, 40 * DEG), TS);
  near(result.phase_rad / DEG, 40, 3, 'phase');
});

test('a DC offset does not change the result', () => {
  const plain = findPhaseDifference(sine(1600, 1, 0), sine(1600, 0.5, -0.5), TS);
  const shifted = findPhaseDifference(sine(1600, 1, 0, 3), sine(1600, 0.5, -0.5, -1.2), TS);
  near(shifted.freq, plain.freq, 1e-6, 'frequency');
  near(shifted.gain, plain.gain, 1e-6, 'gain');
  near(shifted.phase_rad, plain.phase_rad, 1e-6, 'phase');
});

test('a steady sine wave has similar periods', () => {
  // The page rejects a signal when the spread is above 0.3 (with three or more periods).
  for (const freq of [400, 800, 1600, 3200, 10000]) {
    const result = findPhaseDifference(sine(freq, 1, 0), sine(freq, 0.5, -0.5), TS);
    assert.ok(result.periodSpread < 0.3, `spread ${result.periodSpread} at ${freq} Hz`);
  }
});

// The page sets the time base so that a few periods are on the screen: the phase must not depend
// on whole samples (4 periods in 1000 points: one sample is 1.4 degrees).
test('a few periods on the screen: the phase is finer than one sample', () => {
  for (const [periods, lag] of [[4, 17.3], [4, 63.7], [2.5, 41.2], [10, 5.5]]) {
    const ts = periods / 1600 / N;
    const make = (phase, amplitude) => Array.from({ length: N }, (_, i) => amplitude * Math.sin(2 * Math.PI * 1600 * i * ts + phase));
    const result = findPhaseDifference(make(0.3, 1), make(0.3 - lag * DEG, 0.5), ts);
    near(result.phase_rad / DEG, -lag, 0.05, `phase with ${periods} periods`);
    near(result.gain, 0.5, 1e-3, 'gain');
    near(result.freq / 1600, 1, 1e-3, 'frequency');
  }
});

test('noise around zero does not make extra periods (4 periods, noise of 10 percent)', () => {
  const next = random(3);
  const ts = 4 / 1600 / N;
  const make = (phase, amplitude) => Array.from({ length: N }, (_, i) =>
    amplitude * Math.sin(2 * Math.PI * 1600 * i * ts + phase) + 0.1 * amplitude * (next() - 0.5) * 2);
  const result = findPhaseDifference(make(0, 1), make(-0.5, 0.5), ts);
  near(result.freq / 1600, 1, 0.02, 'frequency');
  near(result.gain, 0.5, 0.02, 'gain');
  near(result.phase_rad, -0.5, 0.05, 'phase');
  assert.ok(result.periodSpread < 0.3, `spread ${result.periodSpread}`);
});

test('a harmonic does not move the phase', () => {
  const ts = 4 / 1600 / N;
  const make = (phase, amplitude) => Array.from({ length: N }, (_, i) => {
    const w = 2 * Math.PI * 1600 * i * ts;
    return amplitude * (Math.sin(w + phase) + 0.1 * Math.sin(3 * w));
  });
  const result = findPhaseDifference(make(0, 1), make(-0.8, 0.5), ts);
  near(result.phase_rad, -0.8, 0.02, 'phase');
  near(result.gain, 0.5, 0.01, 'gain');
});

test('a little noise on a sine wave is still a signal', () => {
  const next = random(7);
  const noisy = sine(1600, 1, 0).map((v) => v + 0.02 * (next() - 0.5));
  const result = findPhaseDifference(noisy, sine(1600, 0.7, -0.7), TS);
  assert.ok(result.periodSpread < 0.3, `spread ${result.periodSpread}`);
  near(result.freq / 1600, 1, 0.02, 'frequency');
});

test('noise only is not a signal: many periods that differ a lot', () => {
  const next = random(1);
  const noise = () => Array.from({ length: N }, () => 0.02 * (next() - 0.5) * 2);
  const result = findPhaseDifference(noise(), noise(), TS);
  assert.ok(result.periodCount >= 3, `periods ${result.periodCount}`);
  assert.ok(result.periodSpread > 0.3, `spread ${result.periodSpread}`);
});

test('less than one period: the frequency cannot be found', () => {
  const result = findPhaseDifference(sine(50, 1, 0), sine(50, 1, -0.3), TS);   // 0.5 periods
  assert.equal(result.periodCount, 0);
  assert.ok(!Number.isFinite(result.freq));
  assert.ok(Number.isNaN(result.gain));
});

test('a flat CH1 gives no frequency', () => {
  const flat = Array.from({ length: N }, () => 1);
  const result = findPhaseDifference(flat, sine(1600, 1, 0), TS);
  assert.ok(!Number.isFinite(result.freq));
});

test('a flat CH2 gives zero gain', () => {
  const flat = Array.from({ length: N }, () => 1);
  const result = findPhaseDifference(sine(1600, 1, 0), flat, TS);
  assert.equal(result.gain, 0);
});

test('waves of different lengths give NaN', () => {
  const result = findPhaseDifference(sine(1600, 1, 0), sine(1600, 1, 0).slice(0, 900), TS);
  assert.ok(Number.isNaN(result.gain) && Number.isNaN(result.freq) && Number.isNaN(result.phase_rad));
});

test('the input waves are not changed', () => {
  const a = sine(1600, 1, 0, 2);
  const b = sine(1600, 0.5, -0.5);
  const copyA = [...a];
  const copyB = [...b];
  findPhaseDifference(a, b, TS);
  assert.deepEqual(a, copyA);
  assert.deepEqual(b, copyB);
});

// ---------------------------------------------------------------------------------------------

test('lpf1stOrder: DC passes, the settling time is cut, raw and filtered stay aligned', () => {
  const cutoff = 1 / (2 * Math.PI * 1e-4);   // time constant 100 us = 10 samples
  const constant = Array.from({ length: 200 }, () => 3);
  const { raw, filtered } = lpf1stOrder(constant, cutoff, TS);
  assert.equal(raw.length, filtered.length);
  assert.equal(raw.length, 200 - Math.floor((5 * 1e-4) / TS));
  for (const value of filtered) {
    near(value, 3, 1e-9, 'filtered');
  }
});

test('lpf1stOrder: a slow sine passes, a fast one is attenuated', () => {
  const cutoff = 2000;
  const slow = lpf1stOrder(sine(200, 1, 0), cutoff, TS).filtered;
  const fast = lpf1stOrder(sine(20000, 1, 0), cutoff, TS).filtered;
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(slow) > 0.9, `slow ${peak(slow)}`);
  assert.ok(peak(fast) < 0.2, `fast ${peak(fast)}`);
});

test('lpf1stOrder: no data', () => {
  assert.deepEqual(lpf1stOrder([], 1000, TS), { raw: [], filtered: [] });
});

test('build_xy pairs the two channels', () => {
  assert.deepEqual(build_xy([1, 2, 3], [4, 5, 6]), [{ x: 1, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 6 }]);
});
