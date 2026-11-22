import { setupConnectButton } from '../common/ui.js';
import { state } from './state.js';
import {
    fetchButton, enableKeydownCheckbox, clearPlotsButton, exportAsTsvBodePlotButton, exportBodePlotButton,
    copy2clipboardBodePlotButton, generateSubcktButton, exportAsTsvWaveformButton, exportWaveformButton,
    toggleLissajousChartButton, toggleWaveformChartButton, toggleBodeNyquistPlotButton, toggleNyquistPlotButton,
    toggleFrequencyUnitButton, trimBodePlotButton, importBodePlot,
} from './dom.js';
import { magnitudePlot } from './charts.js';
import { handleActionButtonClick } from './measurement.js';
import * as plotActions from './plotActions.js';
import * as viewToggles from './viewToggles.js';
import { setupPointSelection } from './pointSelection.js';

// The frequency response page: this file connects the buttons to what they do.
//   state.js          what the modules share
//   dom.js            the elements of the page
//   constants.js      numbers and colours the charts and the measurement share
//   charts.js         the five charts
//   measurement.js    fetch, analyse, add a point
//   plotActions.js    clear, save, copy, load, trim, unit
//   pointSelection.js delete points with the mouse
//   viewToggles.js    show and hide charts
//   analysis.js, preprocess.js, bodeData.js, measurementText.js   calculations and texts, no page needed

// Button event listeners
fetchButton.onclick = handleActionButtonClick;
clearPlotsButton.onclick = plotActions.handleClearPlotsButtonClick;
exportAsTsvBodePlotButton.onclick = plotActions.handleExportAsTsvBodePlotButtonClick;
exportBodePlotButton.onclick = plotActions.handleExportBodePlotClick;
copy2clipboardBodePlotButton.onclick = plotActions.handleCopy2clipboardBodePlotClick;
generateSubcktButton.onclick = plotActions.handleGenerateSubcktButtonClick;
exportAsTsvWaveformButton.onclick = plotActions.handleExportAsTsvWaveformButtonClick;
exportWaveformButton.onclick = plotActions.handleExportWaveformClick;
toggleLissajousChartButton.onclick = viewToggles.handleToggleLissajousChartClick;
toggleWaveformChartButton.onclick = viewToggles.handleToggleChartClick;
toggleBodeNyquistPlotButton.onclick = viewToggles.handleTogglePlotClick;
toggleNyquistPlotButton.onclick = viewToggles.handleToggleNyquistPlotClick;
toggleFrequencyUnitButton.onclick = plotActions.handleToggleFrequencyUnitClick;
trimBodePlotButton.onclick = plotActions.handleTrimBodePlotButtonClick;
importBodePlot.addEventListener('change', plotActions.handleImportBodePlotChange);
enableKeydownCheckbox.addEventListener('change', toggleKeydownEvent);

setupConnectButton({
    isOpen: () => state.worker.opened,
    open: (device) => state.worker.open(device),
    close: () => state.worker.close(),
    onChange: (connection) => { fetchButton.disabled = connection !== 'on'; },
});

// Leaving the page closes the connection and drops the plots, so ask first.
window.addEventListener('beforeunload', (event) => {
    const unsavedPlots = magnitudePlot.data.labels.length > 0 && !state.plotsSaved;
    if (state.worker.opened || unsavedPlots) {
        event.preventDefault();
    }
});

setupPointSelection();

function handleSpaceKeyPress(event) {
    if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        fetchButton.click();
    }
}

function toggleKeydownEvent() {
    if (enableKeydownCheckbox.checked) {
        document.addEventListener('keydown', handleSpaceKeyPress);
    } else {
        document.removeEventListener('keydown', handleSpaceKeyPress);
    }
}

// Initial setup based on checkbox state
toggleKeydownEvent();
