import { MAX_DATA_POINTS } from './constants.js';
import { findPhaseDifference } from './analysis.js';
import { lpf1stOrder, build_xy } from './preprocess.js';
import { processBodeData } from './bodeData.js';
import { CAPTURE_PROBLEMS, analysisProblem, formatFrequency } from './measurementText.js';
import { state, markPlotsChanged } from './state.js';
import { fetchButton, autoFetchCheckbox, enableDeleteSwitch, defaultFetchButtonHTML, puaseIcon } from './dom.js';
import { waveformChart, lissajousChart, magnitudePlot, phasePlot, nyquistChart, updateNyquistScale, redrawBodePlot } from './charts.js';
import { showMessage, clearMessages } from '../common/ui.js';

// Fetch the waveforms from the oscilloscope, analyse them and add a point to the plots.

// The numbers behind the newest point
export function showLastMeasurement(analysed) {
    state.lastAnalysed = analysed;
    const dash = '\u2014';
    document.getElementById('last-freq').textContent = analysed ? formatFrequency(analysed.freq, state.frequencyUnit) : dash;
    document.getElementById('last-gain').textContent = analysed ? (20 * Math.log10(analysed.gain)).toFixed(2) + ' dB' : dash;
    document.getElementById('last-phase').textContent = analysed ? (analysed.phase_rad * 180 / Math.PI).toFixed(1) + '\u00b0' : dash;
}

export function handleActionButtonClick() {
    clearMessages();
    if (magnitudePlot.data.labels.length >= MAX_DATA_POINTS || phasePlot.data.labels.length >= MAX_DATA_POINTS) {
        showMessage('warn', 'Maximum data points reached.', 'Clear the plots to continue.');
        return;
    }

    if (state.isFetchDataInterval && autoFetchCheckbox.checked) {
        state.isFetchDataInterval = false;
        fetchButton.innerHTML = defaultFetchButtonHTML;
        autoFetchCheckbox.disabled = false;
    } else {
        if (state.worker.IsBusy) {
            // Worker is busy, handle accordingly
        } else {
            if (autoFetchCheckbox.checked) {
                state.isFetchDataInterval = true;
                autoFetchCheckbox.disabled = true;
            }
        
            fetchButton.innerHTML = puaseIcon + ' Fetching waveforms';
            enableDeleteSwitch.checked = false;

            fetchData();
        }
    }
}

function fetchData() {
    if (magnitudePlot.data.labels.length >= MAX_DATA_POINTS || phasePlot.data.labels.length >= MAX_DATA_POINTS) {
        if (state.isFetchDataInterval) {
            state.isFetchDataInterval = false;
            fetchButton.innerHTML = defaultFetchButtonHTML;
            autoFetchCheckbox.checked = false;
            autoFetchCheckbox.disabled = false;
            showMessage('warn', 'Maximum data points reached.', 'Auto fetch was stopped. Clear the plots to continue.');
        }
        return;
    }
    
    state.worker.fetch().then((result) => {
        if (!result.isSupported) {
            showMessage('err', 'This instrument is not supported.', 'Frequency response works with Tektronix and Keysight / Agilent oscilloscopes.');
            state.isFetchDataInterval = false;
            fetchButton.innerHTML = defaultFetchButtonHTML;
            autoFetchCheckbox.checked = false;
            autoFetchCheckbox.disabled = false;
            return;
        }

        if (isNaN(result.data_ch1[0]) || isNaN(result.data_ch2[0]) || isNaN(result.rate)) {
            if (result.reason !== 'busy') {
                const [title, body] = CAPTURE_PROBLEMS[result.reason] || ['The waveforms could not be read.', 'Check the connection and press Fetch again.'];
                showMessage('warn', title, body);
            }
        }
        else {
            // Apply low-pass filter to both waveforms
            const samplingPeriod = (1 / result.rate);
            const cutoffFreq = (result.rate / 1000);

            const ch1_result = lpf1stOrder(result.data_ch1, cutoffFreq, samplingPeriod);
            const ch2_result = lpf1stOrder(result.data_ch2, cutoffFreq, samplingPeriod);

            // Waveform Chart Data Update
            waveformChart.data.labels = Array.from({ length: ch1_result.filtered.length }, (_, i) => (i * samplingPeriod));
            waveformChart.data.datasets[0].data = ch1_result.raw
            waveformChart.data.datasets[1].data = ch1_result.filtered;
            waveformChart.data.datasets[2].data = ch2_result.raw;
            waveformChart.data.datasets[3].data = ch2_result.filtered;
            waveformChart.update();

            // Lissajous Chart Data Update
            lissajousChart.data.datasets[0].data = build_xy(ch1_result.raw, ch2_result.raw);
            lissajousChart.data.datasets[1].data = build_xy(ch1_result.filtered, ch2_result.filtered);
            lissajousChart.update();

            // The analysis uses the raw waves (it only looks at one frequency); the filter is for the charts.
            const analysed = findPhaseDifference(ch1_result.raw, ch2_result.raw, samplingPeriod);

            const problem = analysisProblem(analysed);
            if (problem) {
                showMessage('warn', problem[0], problem[1]);
            }
            else {
                clearMessages();
                showLastMeasurement(analysed);
                markPlotsChanged();
                magnitudePlot.data.labels.push(analysed.freq);
                magnitudePlot.data.datasets[0].data.push(20 * Math.log10(analysed.gain));
                magnitudePlot.update();
        
                phasePlot.data.labels.push(analysed.freq);
                phasePlot.data.datasets[0].data.push(analysed.phase_rad * 180 / Math.PI);
                phasePlot.update();
                
                if(magnitudePlot.data.labels.length > MAX_DATA_POINTS) {
                    const trimmedData = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);
                    redrawBodePlot(trimmedData);
                }
        
                // Nyquist plot data update
                const realPart = analysed.gain * Math.cos(analysed.phase_rad);
                const imaginaryPart = analysed.gain * Math.sin(analysed.phase_rad);
                nyquistChart.data.datasets[0].data.push({ x: realPart, y: imaginaryPart });
                nyquistChart.data.labels.push(analysed.freq);
                updateNyquistScale(nyquistChart, 1.5);
                nyquistChart.update();
        
            }
        }

        if (!state.isFetchDataInterval) {
            fetchButton.innerHTML = defaultFetchButtonHTML;
        }
        else {
            let nextFetchDelay = 2 * result.length * (1 / result.rate) * 1000; // in ms
            nextFetchDelay = Math.max(nextFetchDelay , 500);
            setTimeout(fetchData, nextFetchDelay);
        }

    }).catch((error) => {
        console.error('Error during fetching waveform:', error);
        showMessage('err', 'Could not read the waveforms.', error && error.message ? error.message : String(error));
        state.isFetchDataInterval = false;
        fetchButton.innerHTML = defaultFetchButtonHTML;
        autoFetchCheckbox.checked = false;
        autoFetchCheckbox.disabled = false;
    });
}
