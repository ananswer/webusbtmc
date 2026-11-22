const HYSTERESIS = 0.25;   // of the amplitude

function removeOffset(wave) {
    const mean = wave.reduce((acc, val) => acc + val, 0) / wave.length;
    return wave.map(val => val - mean);
}

function calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2.0;
}

// Positions (in samples, fractions allowed) where the wave crosses zero going up.
// The position between two samples comes from a straight line through them.
// A crossing counts only after the wave has been below -threshold and then rises above +threshold,
// so noise around zero does not make extra crossings.
function findRisingZeroCrossings(wave) {
    const amplitude = (Math.max(...wave) - Math.min(...wave)) / 2;
    const threshold = HYSTERESIS * amplitude;
    const crossings = [];
    let armed = false;
    let lastBelowZero = -1;   // the last sample that was at or below zero
    for (let i = 0; i < wave.length; i++) {
        if (wave[i] <= 0) lastBelowZero = i;
        if (wave[i] < -threshold) {
            armed = true;
        } else if (armed && wave[i] > threshold) {
            const j = lastBelowZero;   // wave[j] <= 0 and wave[j + 1] > 0
            crossings.push(j + (0 - wave[j]) / (wave[j + 1] - wave[j]));
            armed = false;
        }
    }
    return crossings;
}

/**
 * Gain, frequency and phase of waveB relative to waveA (both sampled every `ts` seconds).
 * Returns { gain, freq, phase_rad, periodCount, periodSpread }. Everything is NaN when the waves
 * differ in length.
 *
 * 1. The frequency comes from the rising zero crossings of waveA: the number of periods between the
 *    first and the last crossing, divided by the time between them.
 * 2. Over those whole periods, each wave is multiplied by cos and sin of that frequency and summed
 *    (a DFT of one frequency, like a lock-in amplifier). The gain is the ratio of the two sizes,
 *    the phase is the difference of the two angles. Noise and harmonics mostly cancel in the sums,
 *    and the phase is not limited to whole samples.
 * periodSpread (the periods differ a little for a sine wave, a lot for noise) tells a steady sine
 * wave from noise.
 */
export function findPhaseDifference(waveA, waveB, ts) {
    if (waveA.length !== waveB.length) {
        return { gain: NaN, freq: NaN, phase_rad: NaN };
    }

    const a = removeOffset(waveA);
    const b = removeOffset(waveB);

    const crossings = findRisingZeroCrossings(a);
    const periods = crossings.slice(1).map((position, i) => position - crossings[i]);
    if (periods.length === 0) {
        return { gain: NaN, freq: Infinity, phase_rad: NaN, periodCount: 0, periodSpread: Infinity };
    }

    const first = crossings[0];
    const last = crossings[crossings.length - 1];
    const freq = periods.length / ((last - first) * ts);

    // Whole periods only, so the sums do not leak. The mean is taken again over the same samples.
    const start = Math.ceil(first);
    const end = Math.ceil(last);
    const omega = 2 * Math.PI * freq * ts;   // radians per sample
    const lockIn = (wave) => {
        let sum = 0;
        for (let i = start; i < end; i++) sum += wave[i];
        const mean = sum / (end - start);
        let cos = 0;
        let sin = 0;
        for (let i = start; i < end; i++) {
            cos += (wave[i] - mean) * Math.cos(omega * i);
            sin += (wave[i] - mean) * Math.sin(omega * i);
        }
        return { cos, sin };
    };
    const A = lockIn(a);
    const B = lockIn(b);

    const gain = Math.hypot(B.cos, B.sin) / Math.hypot(A.cos, A.sin);
    const phase_rad = Math.atan2(B.cos * A.sin - B.sin * A.cos, B.cos * A.cos + B.sin * A.sin);

    const periodSpread = (Math.max(...periods) - Math.min(...periods)) / calculateMedian(periods);

    return { gain: gain, freq: freq, phase_rad: phase_rad, periodCount: periods.length, periodSpread: periodSpread };
}
