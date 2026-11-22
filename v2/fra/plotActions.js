import {
    processBodeData, createLTspiceSubcktContent, createBodeCSVContent, createBodeTSVContent,
    createCSVContent, createTSVContent, parseBodePlotData,
} from './bodeData.js';
import { state, markPlotsChanged, markPlotsSaved } from './state.js';
import {
    exportAsTsvWaveformButton, exportAsTsvBodePlotButton, copy2clipboardBodePlotButton,
    spreadsheetfillClass, spreadsheetClass, clipboardClass, clipboard2checkClass,
} from './dom.js';
import { waveformChart, magnitudePlot, phasePlot, nyquistChart, redrawBodePlot, setFrequencyUnit } from './charts.js';
import { showLastMeasurement } from './measurement.js';
import { showMessage } from '../common/ui.js';

// What the buttons of the plots do: clear, save, copy, load, trim, change the unit.

export function handleClearPlotsButtonClick() {

    if( magnitudePlot.data.datasets[0].data.length <= 0 &&
        phasePlot.data.datasets[0].data.length <= 0 &&
        nyquistChart.data.datasets[0].data.length <= 0)
    {
        return;
    }

    const isConfirmed = confirm('Are you sure to delete the plots?');
    if (!isConfirmed) {
        return;
    }

    magnitudePlot.data.labels = [];
    magnitudePlot.data.datasets[0].data = [];
    magnitudePlot.update();

    phasePlot.data.labels = [];
    phasePlot.data.datasets[0].data = [];
    phasePlot.update();
    
    nyquistChart.data.labels = [];
    nyquistChart.data.datasets[0].data = [];
    nyquistChart.update();
}

export function handleExportAsTsvWaveformButtonClick() {
    const icon = exportAsTsvWaveformButton.querySelector("i");

    if(state.tsvOnWaveform) {
        state.tsvOnWaveform = false;
        icon.classList.replace(spreadsheetfillClass, spreadsheetClass);
    }
    else {
        state.tsvOnWaveform = true;
        icon.classList.replace(spreadsheetClass, spreadsheetfillClass);
    }
}

export function handleExportWaveformClick() {
    if (waveformChart.data.labels.length === 0) {
        return;
    }
    const isTSV = state.tsvOnWaveform;
    const fileExtension = isTSV ? 'txt' : 'csv';
    const fileName = `waveform_data.${fileExtension}`;

    const times = waveformChart.data.labels;
    const ch1_raw = waveformChart.data.datasets[0].data;
    const ch1_filtered = waveformChart.data.datasets[1].data;
    const ch2_raw = waveformChart.data.datasets[2].data;
    const ch2_filtered = waveformChart.data.datasets[3].data;

    let content;
    if(isTSV) {
        content = createTSVContent(times, ch1_raw, ch1_filtered, ch2_raw, ch2_filtered);
    }
    else {
        content = createCSVContent(times, ch1_raw, ch1_filtered, ch2_raw, ch2_filtered);
    }


    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function handleExportAsTsvBodePlotButtonClick() {
    const icon = exportAsTsvBodePlotButton.querySelector("i");

    if(state.tsvOnBode) {
        state.tsvOnBode = false;
        icon.classList.replace(spreadsheetfillClass, spreadsheetClass);
    }
    else {
        state.tsvOnBode = true;
        icon.classList.replace(spreadsheetClass, spreadsheetfillClass);
    }
}

export function handleExportBodePlotClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    const isTSV = state.tsvOnBode;
    const fileExtension = isTSV ? 'txt' : 'csv';
    const fileName = `bode_plot_data`;

    const processed = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);

    let contents;
    if(isTSV) {
        contents = createBodeTSVContent(processed);
    }
    else {
        contents = createBodeCSVContent(processed, state.frequencyUnit);
    }

    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + `.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    markPlotsSaved();
}

export function handleCopy2clipboardBodePlotClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    const processed = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);
    const contents = createBodeTSVContent(processed);

    const icon = copy2clipboardBodePlotButton.querySelector("i");
    navigator.clipboard.writeText(contents).then(
        () => {
            markPlotsSaved();
            icon.classList.replace(clipboardClass, clipboard2checkClass);

            setTimeout(() => {
                icon.classList.replace(clipboard2checkClass, clipboardClass);
            }, 2000);
        },
        () => {
            showMessage('warn', 'Could not copy to the clipboard.');
        }
    );
}

export function handleGenerateSubcktButtonClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    let num_string = state.subcktNumber.toString().padStart(3, '0');

    const fileName = `bode_plot_data` + num_string;
    
    const processed = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);

    let contents = createLTspiceSubcktContent(processed, fileName);

    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.sub';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    state.subcktNumber = state.subcktNumber + 1;
    markPlotsSaved();
}

export function handleImportBodePlotChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const contents = e.target.result;
            const parsedData = parseBodePlotData(contents);
            if (parsedData.unit) {
                setFrequencyUnit(parsedData.unit);
            }
            redrawBodePlot(parsedData);
            markPlotsSaved();
        };
        reader.readAsText(file);
        event.target.value = '';    // Reset input element to allow selecting the same file again
    }
}

export function handleToggleFrequencyUnitClick() {
    setFrequencyUnit(state.frequencyUnit === 'Hz' ? 'rad/s' : 'Hz');
    magnitudePlot.update();
    phasePlot.update();
    if (state.lastAnalysed) {
        showLastMeasurement(state.lastAnalysed);
    }
}

export function handleTrimBodePlotButtonClick() {
    markPlotsChanged();
    const trimmedData = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);
    redrawBodePlot(trimmedData);
}
