// What to tell the user about a measurement. No page needed.

// ---- Why a fetch gave nothing
export const CAPTURE_PROBLEMS = {
    'no-waveform': ['The instrument has no waveform to read.', 'Check that CH1 and CH2 are on and show a signal, and that the instrument is running.'],
    'format-changed': ['The instrument was set to send waveforms as bytes.', 'Press Fetch again.'],
    'length-mismatch': ['CH1 and CH2 returned different numbers of points.', 'Check that both channels are on, then press Fetch again.'],
};

// Why the waveforms cannot be analysed, or null when they can.

// Why the waveforms cannot be analysed, or null when they can.
export function analysisProblem(analysed) {
    if (!isFinite(analysed.freq)) {
        return ['The frequency of CH1 could not be found.',
            'CH1 must show at least two periods of a sine wave with a large enough amplitude. Adjust the horizontal and vertical ranges of the oscilloscope.'];
    }
    // With few periods the spread says little. With more, a real sine wave has nearly equal periods.
    if (analysed.periodCount >= 3 && analysed.periodSpread > 0.3) {
        return ['The signal in CH1 is too small or not a steady sine wave.',
            'Check that the output of the generator is on, then increase the amplitude or adjust the vertical range of the oscilloscope.'];
    }
    if (!(analysed.gain > 0) || !isFinite(analysed.gain)) {
        return ['CH2 shows no signal.', 'Check the connection to the output of the circuit and the vertical range of CH2.'];
    }
    return null;
}

// The frequency with a prefix and four digits: 1.600 kHz. `unit` is 'Hz' or 'rad/s'.
export function formatFrequency(hz, unit) {
    const value = unit === 'Hz' ? hz : hz * 2 * Math.PI;
    const [scale, prefix] = [[1e6, 'M'], [1e3, 'k'], [1, '']].find(([s]) => Math.abs(value) >= s) || [1, ''];
    return (value / scale).toPrecision(4) + ' ' + prefix + unit;
}
