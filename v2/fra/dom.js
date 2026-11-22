// The elements of the page and a few constants for its buttons.
// Get DOM elements
export const waveformCtx = document.getElementById('waveformChart').getContext('2d', { willReadFrequently: true });
export const lissajousCtx = document.getElementById('lissajousChart').getContext('2d', { willReadFrequently: true });

export const magnitudeCtx = document.getElementById('magnitudePlot').getContext('2d', { willReadFrequently: true });
export const phaseCtx = document.getElementById('phasePlot').getContext('2d', { willReadFrequently: true });

export const nyquistCtx = document.getElementById('nyquistPlot').getContext('2d', { willReadFrequently: true });

export const magnitudeCanvas = document.getElementById('magnitudePlot').closest('canvas');
export const phaseCanvas = document.getElementById('phasePlot').closest('canvas');
export const nyquistCanvas = document.getElementById('nyquistPlot').closest('canvas');

export const fetchButton = document.getElementById('fetch-button');
export const autoFetchCheckbox = document.getElementById('auto-fetch-checkbox');

export const exportAsTsvWaveformButton = document.getElementById('tsv-waveform-button'); 
export const exportWaveformButton = document.getElementById('export-waveform-button');
export const toggleWaveformChartButton = document.getElementById('toggle-waveform-chart');
export const toggleLissajousChartButton = document.getElementById('toggle-lissajous-chart');

export const clearPlotsButton = document.getElementById('clear-plots-button');

export const exportAsTsvBodePlotButton = document.getElementById('tsv-bodeplot-button');
export const importBodePlot = document.getElementById('import-bodeplot-file');
export const exportBodePlotButton = document.getElementById('export-bodeplot-button');
export const copy2clipboardBodePlotButton = document.getElementById('copy2clipboard-bodeplot-button');

export const generateSubcktButton = document.getElementById('generate-subckt-button');
export const toggleFrequencyUnitButton = document.getElementById('toggle-frequency-unit');
export const toggleBodeNyquistPlotButton = document.getElementById('toggle-bode-nyquist-plot');

export const toggleNyquistPlotButton = document.getElementById('toggle-nyquist-plot');

export const enableDeleteSwitch = document.getElementById('enable-delete-switch');
export const trimBodePlotButton = document.getElementById('trimBodePlotButton');

export const enableKeydownCheckbox = document.getElementById('enable-keydown-checkbox');

// Store the default HTML content of the each buttons
export const defaultFetchButtonHTML = fetchButton.innerHTML;

// Spinner and icon HTML snippets
export const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
export const puaseIcon ='<i class="bi bi-pause"></i>';

// Define class names as constants
export const spreadsheetfillClass = 'bi-file-earmark-spreadsheet-fill';
export const spreadsheetClass = 'bi-file-earmark-spreadsheet';

export const clipboardClass = 'bi-clipboard';
export const clipboard2checkClass = 'bi-clipboard2-check';
