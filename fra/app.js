'use strict';

import GetCurve from './getCurve.js';
import { MAX_DATA_POINTS } from './chartConfig.js';
import { userColors } from './chartConfig.js';

let worker = new GetCurve();
let isTSVonWave = false;
let isTSVonBode = false;
let frequencyUnit = 'Hz';
let subckt_num = 1;

// Get DOM elements
const waveformCtx = document.getElementById('waveformChart').getContext('2d', { willReadFrequently: true });
const lissajousCtx = document.getElementById('lissajousChart').getContext('2d', { willReadFrequently: true });

const magnitudeCtx = document.getElementById('magnitudePlot').getContext('2d', { willReadFrequently: true });
const phaseCtx = document.getElementById('phasePlot').getContext('2d', { willReadFrequently: true });

const nyquistCtx = document.getElementById('nyquistPlot').getContext('2d', { willReadFrequently: true });

const magnitudeCanvas = document.getElementById('magnitudePlot').closest('canvas');
const phaseCanvas = document.getElementById('phasePlot').closest('canvas');
const nyquistCanvas = document.getElementById('nyquistPlot').closest('canvas');

const connectButton = document.getElementById('connect-button');
const fetchButton = document.getElementById('fetch-button');
const autoFetchCheckbox = document.getElementById('auto-fetch-checkbox');

const exportAsTsvWaveformButton = document.getElementById('tsv-waveform-button'); 
const exportWaveformButton = document.getElementById('export-waveform-button');
const toggleWaveformChartButton = document.getElementById('toggle-waveform-chart');
const toggleLissajousChartButton = document.getElementById('toggle-lissajous-chart');

const clearPlotsButton = document.getElementById('clear-plots-button');

const exportAsTsvBodePlotButton = document.getElementById('tsv-bodeplot-button');
const importBodePlot = document.getElementById('import-bodeplot-file');
const exportBodePlotButton = document.getElementById('export-bodeplot-button');
const copy2clipboardBodePlotButton = document.getElementById('copy2clipboard-bodeplot-button');

const generateSubcktButton = document.getElementById('generate-subckt-button');
const toggleFrequencyUnitButton = document.getElementById('toggle-frequency-unit');
const toggleBodeNyquistPlotButton = document.getElementById('toggle-bode-nyquist-plot');

const toggleNyquistPlotButton = document.getElementById('toggle-nyquist-plot');

const enableDeleteSwitch = document.getElementById('enable-delete-switch');
const trimBodePlotButton = document.getElementById('trimBodePlotButton');

const windowsAdviceText = document.getElementById('windows-advice-text');

const enableKeydownCheckbox = document.getElementById('enable-keydown-checkbox');

// Store the default HTML content of the each buttons
const defaultFetchButtonHTML = fetchButton.innerHTML;
const defaultconnectButtonHTML = connectButton.innerHTML;

// Spinner and icon HTML snippets
const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const puaseIcon ='<i class="bi bi-pause"></i>';
const plugfillIcon = '<i class="bi bi-plug-fill"></i>';

// Define class names as constants
const spreadsheetfillClass = 'bi-file-earmark-spreadsheet-fill';
const spreadsheetClass = 'bi-file-earmark-spreadsheet';

const clipboardClass = 'bi-clipboard';
const clipboard2checkClass = 'bi-clipboard2-check';

// Function to generate points on a unit circle
function generateUnitCirclePoints(numPoints = 200) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        points.push({ x: Math.cos(angle), y: Math.sin(angle) });
    }
    return points;
}

const unitCirclePoints = generateUnitCirclePoints();

// Chart configurations
const waveformConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Ch1',
                borderColor: userColors.blue[5],
                pointBackgroundColor: userColors.blue[5],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y1',
            },
            {
                label: 'Ch1_filtered',
                borderColor: userColors.blue[7],
                pointBackgroundColor: userColors.blue[7],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y1',
                hidden: true,
            },
            {
                label: 'Ch2',
                borderColor: userColors.red[5],
                pointBackgroundColor: userColors.red[5],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y2',
            },
            {
                label: 'Ch2_filtered',
                borderColor: userColors.red[7],
                pointBackgroundColor: userColors.red[7],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y2',
                hidden: true,
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: {
                display: true
            },
            tooltip: {
                callbacks: {
                    title: function (context) {
                        let value = context[0].chart.data.labels[context[0].dataIndex];
                        let title = `T:${value.toExponential(2)} sec`;
                        return title;
                    },
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += context.parsed.y;
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 't (sec.)'
                },
                ticks: {
                    callback: function (value) {
                        return value.toExponential(2);
                    }
                }
            },
            y1: {
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Amplitude Ch1'
                }
            },
            y2: {
                type: 'linear',
                position: 'right',
                title: {
                    display: true,
                    text: 'Amplitude Ch2'
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        },
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 20,
                bottom: 20
            }
        }
    }
};

const lissajousConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'xy',
                borderColor: userColors.green[5],
                pointBackgroundColor: userColors.green[5],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
            {
                label: 'xy_filterd',
                borderColor: userColors.green[7],
                pointBackgroundColor: userColors.green[7],
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                hidden: true,
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            tooltip: {
                enabled: false
            }
        },
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Channel 1'
                }
            },
            y: {
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Channel 2'
                }
            }
        },
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 20,
                bottom: 20
            }
        }
    }
};

const magnitudeConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Magnitude (dB)',
            data: [],
            borderColor: userColors.blue[6],
            pointBackgroundColor: userColors.blue[4],
            showLine: false,
            fill: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 20,
                bottom: 20
            }
        },
        scales: {
            x: {
                type: 'logarithmic',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Frequency'
                },
                ticks: {
                    callback: (value) => {
                        return frequencyUnit === 'Hz' ? `${value} Hz` : `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
                    }
                }
            },
            y: {
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Magnitude (dB)'
                },
                ticks: {
                    stepSize: 20
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    lineWidth: 1
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title: function (context) {
                        let value = context[0].chart.data.labels[context[0].dataIndex];
                        let title = 'Frequency:';
                        if(frequencyUnit === 'Hz') {
                            title += `${value.toFixed(3)} Hz`;
                        }
                        else {
                            title += `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
                        }

                        return title;
                    },
                    label: (context) => `${context.dataset.label}: ${context.raw.toFixed(3)}`
                }
            },
            legend: {
                display: false
            }
        }
    }
};

const phaseConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Phase (degrees)',
            data: [],
            borderColor: userColors.red[6],
            pointBackgroundColor: userColors.red[4],
            showLine: false,
            fill: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 20,
                bottom: 20
            }
        },
        scales: {
            x: {
                type: 'logarithmic',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Frequency'
                },
                ticks: {
                    callback: (value) => {
                        return frequencyUnit === 'Hz' ? `${value} Hz` : `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
                    }
                }
            },
            y: {
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Phase (degrees)'
                },
                ticks: {
                    stepSize: 45
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    lineWidth: 1
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title: function (context) {
                        let value = context[0].chart.data.labels[context[0].dataIndex];
                        let title = 'Frequency:';
                        if(frequencyUnit === 'Hz') {
                            title += `${value.toFixed(3)} Hz`;
                        }
                        else {
                            title += `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
                        }

                        return title;
                    },
                    label: (context) => `${context.dataset.label}: ${context.raw.toFixed(3)}`
                }
            },
            legend: {
                display: false
            }
        }
    }
};

const nyquistConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Nyquist Plot',
            borderColor: userColors.green[7],
            pointBackgroundColor: userColors.green[3],
            data: [],
            fill: false,
            showLine: false,
            tooltip: true
        },
        {
            label: 'Unit Circle',
            borderColor: userColors.blue[4],
            pointBackgroundColor: userColors.blue[4],
            data: unitCirclePoints,
            fill: false,
            showLine: true,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderDash: [5, 5],
            tooltip: false
        },
        {
            label: 'Stability Point',
            borderColor: userColors.red[6],
            pointBackgroundColor: userColors.red[6],
            data: [{ x: -1, y: 0 }],
            fill: false,
            showLine: false,
            pointRadius: 5,
            pointHoverRadius: 5,
            tooltip: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 20,
                bottom: 20
            }
        },
        scales: {
            x: {
                type: 'linear',
                max: 1.5,
                min: -1.5,
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Real Part'
                },
                ticks: {
                    stepSize: 0.5
                }
            },
            y: {
                type: 'linear',
                max: 1.5,
                min: -1.5,
                position: 'left',
                title: {
                    display: true,
                    text: 'Imaginary Part'
                },
                ticks: {
                    stepSize: 0.5
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                filter: function (tooltipItem) {
                    // Filter out tooltips for datasets that have tooltip disabled
                    return tooltipItem.dataset.tooltip !== false;
                },
                callbacks: {
                    title: function (context) {
                        if (!context[0]) {
                            return '';
                        }
                        let value = context[0].chart.data.labels[context[0].dataIndex];
                        let title = 'Frequency:';
                        if(frequencyUnit === 'Hz') {
                            title += `${value.toFixed(3)} Hz`;
                        }
                        else {
                            title += `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
                        }

                        return title;
                    },
                    label: (context) => `Real: ${context.parsed.x.toFixed(3)}, Imag: ${context.parsed.y.toFixed(3)}`
                }
            }
        }
    }
};


// Create charts
const waveformChart = new Chart(waveformCtx, waveformConfig);
const lissajousChart = new Chart(lissajousCtx, lissajousConfig);
const magnitudePlot = new Chart(magnitudeCtx, magnitudeConfig);
const phasePlot = new Chart(phaseCtx, phaseConfig);
const nyquistChart = new Chart(nyquistCtx, nyquistConfig);

// Button event listeners
connectButton.onclick = handleConnectButtonClick;
fetchButton.onclick = handleActionButtonClick;
clearPlotsButton.onclick = handleClearPlotsButtonClick;
exportAsTsvBodePlotButton.onclick = handleExportAsTsvBodePlotButtonClick
exportBodePlotButton.onclick = handleExportBodePlotClick;
copy2clipboardBodePlotButton.onclick = handleCopy2clipboardBodePlotClick;
generateSubcktButton.onclick = handleGenerateSubcktButtonClick;
exportAsTsvWaveformButton.onclick = handleExportAsTsvWaveformButtonClick;
exportWaveformButton.onclick = handleExportWaveformClick;
toggleLissajousChartButton.onclick = handleToggleLissajousChartClick;
toggleWaveformChartButton.onclick = handleToggleChartClick;
toggleBodeNyquistPlotButton.onclick = handleTogglePlotClick;
toggleNyquistPlotButton.onclick = handleToggleNyquistPlotClick;
toggleFrequencyUnitButton.onclick = handleToggleFrequencyUnitClick;
trimBodePlotButton.onclick = handleTrimBodePlotButtonClick;
importBodePlot.addEventListener('change', handleImportBodePlotChange);
enableKeydownCheckbox.addEventListener('change', toggleKeydownEvent);

window.onload = handleWindowLoad;

let isDragging = false;
let startPoint = { x: 0, y: 0 };
let endPoint = { x: 0, y: 0 };
let savedImageMagnitudeData;
let savedImagePhaseData;
let savedImageNyquistData;
let selectedDataPointIndex = null;
let isFetchDataInterval = false;

// Chart click handlers for data deletion
magnitudeCtx.canvas.onclick = handleClick;
phaseCtx.canvas.onclick = handleClick;
nyquistCtx.canvas.onclick = handleClick;

// Setup canvas event listeners for data selection
setupCanvasEventListeners(magnitudeCanvas, magnitudeCtx, magnitudePlot, savedImageMagnitudeData, startPoint, endPoint);
setupCanvasEventListeners(phaseCanvas, phaseCtx, phasePlot, savedImagePhaseData, startPoint, endPoint);
setupCanvasEventListeners(nyquistCanvas, nyquistCtx, nyquistChart, savedImageNyquistData, startPoint, endPoint);

function handleToggleLissajousChartClick() {
    const waveformContainer = document.getElementById('waveformContainer');
    const lissajousContainer = document.getElementById('lissajousContainer');

    if (lissajousContainer.style.display === 'none') {
        lissajousContainer.style.display = 'block';
        waveformContainer.classList.remove('w-100');
        waveformContainer.classList.add('w-50');
    } else {
        lissajousContainer.style.display = 'none';
        waveformContainer.classList.remove('w-50');
        waveformContainer.classList.add('w-100');
    }
}

function handleToggleNyquistPlotClick() {
    const bodePlotContainer = document.getElementById('bodePlotContainer');
    const nyquistPlotContainer = document.getElementById('nyquistPlotContainer');

    if (nyquistPlotContainer.style.display === 'none') {
        nyquistPlotContainer.style.display = 'block';
        bodePlotContainer.classList.remove('w-100');
        bodePlotContainer.classList.add('w-50');
    } else {
        nyquistPlotContainer.style.display = 'none';
        bodePlotContainer.classList.remove('w-50');
        bodePlotContainer.classList.add('w-100');
    }
}

function toggleVisibility(element) {
    if (element.style.display === 'none') {
        element.style.display = 'block';
    } else {
        element.style.display = 'none';
    }
}

function handleToggleChartClick() {
    toggleVisibility(document.getElementById('chartContainer'));
}

function handleTogglePlotClick() {
    toggleVisibility(document.getElementById('plotContainer'));
}

function handleConnectButtonClick() {
    if (worker.opened) {
        worker.close();
        connectButton.innerHTML = defaultconnectButtonHTML;
        fetchButton.disabled = true;
    } else {
        const filters = [
            { 'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01 },
        ];
        navigator.usb.requestDevice({ 'filters': filters })
            .then((device) => {
                connectButton.innerHTML = spinnerWidget + ' Connecting..';
                connectButton.disabled = true;

                worker.open(device)
                    .then(() => {
                        const deviceName = worker.device.productName.replace(/\s/g, '');
                        connectButton.innerHTML = plugfillIcon + ' ' + deviceName + ' is connected';
                        fetchButton.disabled = false;
                    })
                    .catch((error) => {
                        alert(error);
                        connectButton.innerHTML = defaultconnectButtonHTML;
                        fetchButton.disabled = true;
                    })
                    .finally(() => {
                        connectButton.disabled = false;
                    });
            })
            .catch((error) => {
                alert(error);
            });
    }
}

function handleActionButtonClick() {
    if (magnitudePlot.data.labels.length >= MAX_DATA_POINTS || phasePlot.data.labels.length >= MAX_DATA_POINTS) {
        alert('Maximum data points reached.');
        return;
    }

    if (isFetchDataInterval && autoFetchCheckbox.checked) {
        isFetchDataInterval = false;
        fetchButton.innerHTML = defaultFetchButtonHTML;
        autoFetchCheckbox.disabled = false;
    } else {
        if (worker.IsBusy) {
            // Worker is busy, handle accordingly
        } else {
            if (autoFetchCheckbox.checked) {
                isFetchDataInterval = true;
                autoFetchCheckbox.disabled = true;
            }
        
            fetchButton.innerHTML = puaseIcon + ' Fetching waveforms';
            enableDeleteSwitch.checked = false;

            fetchData();
        }
    }
}

function handleClearPlotsButtonClick() {

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

function handleExportAsTsvWaveformButtonClick() {
    const icon = exportAsTsvWaveformButton.querySelector("i");

    if(isTSVonWave) {
        isTSVonWave = false;
        icon.classList.replace(spreadsheetfillClass, spreadsheetClass);
    }
    else {
        isTSVonWave = true;
        icon.classList.replace(spreadsheetClass, spreadsheetfillClass);
    }
}

function handleExportWaveformClick() {
    if (waveformChart.data.labels.length === 0) {
        return;
    }
    const isTSV = isTSVonWave;
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

function handleExportAsTsvBodePlotButtonClick() {
    const icon = exportAsTsvBodePlotButton.querySelector("i");

    if(isTSVonBode) {
        isTSVonBode = false;
        icon.classList.replace(spreadsheetfillClass, spreadsheetClass);
    }
    else {
        isTSVonBode = true;
        icon.classList.replace(spreadsheetClass, spreadsheetfillClass);
    }
}

function handleExportBodePlotClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    const isTSV = isTSVonBode;
    const fileExtension = isTSV ? 'txt' : 'csv';
    const fileName = `bode_plot_data`;

    const processed = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);

    let contents;
    if(isTSV) {
        contents = createBodeTSVContent(processed);
    }
    else {
        contents = createBodeCSVContent(processed, frequencyUnit);
    }

    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + `.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function handleCopy2clipboardBodePlotClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    const processed = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);
    const contents = createBodeTSVContent(processed);

    const icon = copy2clipboardBodePlotButton.querySelector("i");
    navigator.clipboard.writeText(contents).then(
        () => {
            icon.classList.replace(clipboardClass, clipboard2checkClass);

            setTimeout(() => {
                icon.classList.replace(clipboard2checkClass, clipboardClass);
            }, 2000);
        },
        () => {
            alert("Failed to copy.");
        }
    );
}

function handleGenerateSubcktButtonClick() {
    if (magnitudePlot.data.labels.length === 0) {
        return;
    }

    let num_string = subckt_num.toString().padStart(3, '0');

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
    
    subckt_num = subckt_num + 1;
}

function handleImportBodePlotChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const contents = e.target.result;
            const parsedData = parseBodePlotData(contents);
            if (parsedData.unit) {
                frequencyUnit = parsedData.unit;
                magnitudePlot.options.scales.x.title.text = `Frequency (${frequencyUnit})`;
                phasePlot.options.scales.x.title.text = `Frequency (${frequencyUnit})`;
            }
            redrawBodePlot(parsedData);
        };
        reader.readAsText(file);
        event.target.value = '';    // Reset input element to allow selecting the same file again
    }
}

function handleToggleFrequencyUnitClick() {
    frequencyUnit = frequencyUnit === 'Hz' ? 'rad/s' : 'Hz';
    magnitudePlot.options.scales.x.title.text = `Frequency (${frequencyUnit})`;
    phasePlot.options.scales.x.title.text = `Frequency (${frequencyUnit})`;
    magnitudePlot.update();
    phasePlot.update();
}

function handleTrimBodePlotButtonClick() {
    const trimmedData = processBodeData(magnitudePlot.data.labels, magnitudePlot.data.datasets[0].data, phasePlot.data.datasets[0].data);
    redrawBodePlot(trimmedData);
}

function handleWindowLoad() {
    if (navigator.platform.indexOf('Win') >= 0) {
        windowsAdviceText.classList.remove('d-none');
    }
}

function fetchData() {
    if (magnitudePlot.data.labels.length >= MAX_DATA_POINTS || phasePlot.data.labels.length >= MAX_DATA_POINTS) {
        if (isFetchDataInterval) {
            isFetchDataInterval = false;
            fetchButton.innerHTML = defaultFetchButtonHTML;
            autoFetchCheckbox.checked = false;
            autoFetchCheckbox.disabled = false;
            alert('Maximum data points reached. Auto fetch stopped.');
        }
        return;
    }
    
    worker.fetch().then((result) => {
        if (!result.isSupported) {
            alert('Not supported device.');
            fetchButton.innerHTML = defaultFetchButtonHTML;
            autoFetchCheckbox.checked = false;
            autoFetchCheckbox.disabled = false;
            return;
        }

        if (isNaN(result.rate)) {
            return;
        }

        // Apply low-pass filter to both waveforms
        const samplingPeriod = (1 / result.rate);
        const cutoffFreq = (result.rate / 1000);

        let ch1_result = lpf1stOrder(result.data_ch1, cutoffFreq, samplingPeriod);
        if (ch1_result.filtered.length === 0) {
            return;
        }

        let ch2_result = lpf1stOrder(result.data_ch2, cutoffFreq, samplingPeriod);
        if (ch2_result.filtered.length === 0) {
            return;
        }

        if (ch1_result.filtered.length !== ch2_result.filtered.length) {
            return;
        }

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

        const analysed = findPhaseDifference(ch1_result.filtered, ch2_result.filtered, samplingPeriod);

        if (isNaN(analysed.gain)) {
            return;
        }

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

        if (!isFetchDataInterval) {
            fetchButton.innerHTML = defaultFetchButtonHTML;
        }
        else {
            let nextFetchDelay = 2 * result.length * (1 / result.rate) * 1000; // in ms
            nextFetchDelay = Math.max(nextFetchDelay , 500);
            setTimeout(fetchData, nextFetchDelay);
        }

    }).catch((error) => {
        console.error('Error during fetching waveform:', error);
        alert('An error occurred while fetching waveform.');
        fetchButton.innerHTML = defaultFetchButtonHTML;
        autoFetchCheckbox.checked = false;
        autoFetchCheckbox.disabled = false;
    });
}

function updateNyquistScale(chart, limit) {
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    chart.data.datasets[0].data.forEach(point => {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    });

    minX = Math.min(minX, -limit);
    maxX = Math.max(maxX, limit);
    minY = Math.min(minY, -limit);
    maxY = Math.max(maxY, limit);

    chart.options.scales.x.min = minX;
    chart.options.scales.x.max = maxX;
    chart.options.scales.y.min = minY;
    chart.options.scales.y.max = maxY;
}

function processBodeData(freqs, dataA, dataB) {
    const combined = freqs.map((freq, index) => ({
        freq: Math.trunc(freq),
        dataA: dataA[index],
        dataB: dataB[index]
    }));

    combined.sort((a, b) => a.freq - b.freq);

    const result = {
        frequencies: [],
        magnitudes: [],
        phases: []
    };

    let currentFreq = combined[0].freq;
    let sumDataA = 0;
    let sumDataB = 0;
    let count = 0;

    combined.forEach((item) => {
        if (Math.abs(item.freq - currentFreq) < 1) {
            sumDataA += item.dataA;
            sumDataB += item.dataB;
            count += 1;
        } else {
            result.frequencies.push(currentFreq);
            result.magnitudes.push(sumDataA / count);
            result.phases.push(sumDataB / count);

            currentFreq = item.freq;
            sumDataA = item.dataA;
            sumDataB = item.dataB;
            count = 1;
        }
    });
    result.frequencies.push(currentFreq);
    result.magnitudes.push(sumDataA / count);
    result.phases.push(sumDataB / count);

    return result;
}

function createLTspiceSubcktContent(data,file_name) {
    let contents = `.subckt ${file_name} 1 2\n`;
    contents += `E 2 0 FREQ {V(1,0)} =\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        contents += `+(${data.frequencies[i].toExponential(14)},${data.magnitudes[i].toExponential(14)},${data.phases[i].toExponential(14)})\n`;
    }
    contents += `.ends`;
    return contents;
}

function createBodeCSVContent(data, unit) {
    let csvContent = `Frequency (${unit}),Magnitude (dB),Phase (degrees)\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        const frequency = unit === 'rad/s' ? data.frequencies[i] * 2 * Math.PI : data.frequencies[i];
        csvContent += `${frequency},${data.magnitudes[i]},${data.phases[i]}\n`;
    }
    return csvContent;
}

function createBodeTSVContent(data) {
    let contents = `Frequency\tMagnitude\tPhase\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        contents += `${data.frequencies[i]}\t${data.magnitudes[i]}\t${data.phases[i]}\n`;
    }
    return contents;
}

function createCSVContent(times, a, b, c, d) {
    let csvContent = 'Time(s),Ch1_raw,Ch1_filtered,Ch2_raw,Ch2_filtered\n';
    for (let i = 0; i < times.length; i++) {
        csvContent += `${times[i]},${a[i]},${b[i]},${c[i]},${d[i]}\n`;
    }
    return csvContent;
}

function createTSVContent(times, a, b, c, d) {
    let tsvContent = 'Time\tCh1_raw\tCh1_filtered\tCh2_raw\tCh2_filtered\n';
    for (let i = 0; i < times.length; i++) {
        tsvContent += `${times[i]}\t${a[i]}\t${b[i]}\t${c[i]}\t${d[i]}\n`;
    }
    return tsvContent;
}

function setupCanvasEventListeners(canvas, ctx, chart, savedImageData, startPoint, endPoint) {
    canvas.addEventListener('mousedown', (event) => {
        const rect = event.target.getBoundingClientRect();
        isDragging = true;
        startPoint.x = event.clientX - rect.left;
        startPoint.y = event.clientY - rect.top; 
        // Initialize endpoint
        endPoint.x = startPoint.x;
        endPoint.y = startPoint.y;
        savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    });

    canvas.addEventListener('mousemove', (event) => {
        if (isDragging) {
            const rect = event.target.getBoundingClientRect();
            endPoint.x = event.clientX - rect.left;
            endPoint.y = event.clientY - rect.top; 
            ctx.putImageData(savedImageData, 0, 0);
            drawSelectionRectangle(ctx,startPoint,endPoint);
        }
    });

    canvas.addEventListener('mouseup', (event) => {
        if (isDragging) {
            isDragging = false;
            ctx.putImageData(savedImageData, 0, 0);  // Clear the selection rectangle

            if (!enableDeleteSwitch.checked) {
                return;
            }

            const selectedPoints = getSelectedPoints(startPoint, endPoint, chart);
            removeSelectedPoints(magnitudePlot, selectedPoints);
            magnitudePlot.update();
            removeSelectedPoints(phasePlot, selectedPoints);
            phasePlot.update();
            removeSelectedPoints(nyquistChart, selectedPoints);
            nyquistChart.update();
        }
    });

    canvas.addEventListener('mouseleave', (event) => {
        if (isDragging) {
            isDragging = false;
            ctx.putImageData(savedImageData, 0, 0);  // Clear the selection rectangle
        }
    });
}

function drawSelectionRectangle(ctx, start, end) {
    ctx.strokeStyle = 'rgba(0,0,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
}

function getSelectedPoints(start, end, chart) {
    const selectedPoints = [];
    const datasets = chart.data.datasets;

    if (datasets.length >= 1) {
        datasets[0].data.forEach((dataPoint, index) => {
            const meta = chart.getDatasetMeta(0);
            const point = meta.data[index];
            const x = point.x;
            const y = point.y;

            if (x >= Math.min(start.x, end.x) && x <= Math.max(start.x, end.x) &&
                y >= Math.min(start.y, end.y) && y <= Math.max(start.y, end.y)) {
                selectedPoints.push(index);
            }
        });
    }

    return selectedPoints;
}

function removeSelectedPoints(chart, selectedPoints) {
    // Sort in descending order to prevent index shifting issues
    selectedPoints.sort((a, b) => b - a);
    selectedPoints.forEach(point => {
        removeDataPoint(chart, point);
    });
}

function removeDataPoint(chart, index) {
    chart.data.labels.splice(index, 1);
    chart.data.datasets[0].data.splice(index, 1);
}

function getElementAtEvent(chart, event) {
    return chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
}

function handleClick(event) {
    if (!enableDeleteSwitch.checked) {
        return;
    }

    const activeElementMagnitude = getElementAtEvent(magnitudePlot, event);
    const activeElementPhase = getElementAtEvent(phasePlot, event);
    const activeElementNyquist = getElementAtEvent(nyquistChart, event);

    if (activeElementMagnitude.length > 0) {
        selectedDataPointIndex = activeElementMagnitude[0].index;
    } else if (activeElementPhase.length > 0) {
        selectedDataPointIndex = activeElementPhase[0].index;
    } else if (activeElementNyquist.length > 0) {
        selectedDataPointIndex = activeElementNyquist[0].index;
    } else {
        selectedDataPointIndex = null;
    }

    if (selectedDataPointIndex !== null) {
        removeDataPoint(magnitudePlot, selectedDataPointIndex);
        magnitudePlot.update();
        removeDataPoint(phasePlot, selectedDataPointIndex);
        phasePlot.update();
        removeDataPoint(nyquistChart, selectedDataPointIndex);
        nyquistChart.update();

    }
}

function updateChartOptionsinteraction(chart, isEnabled) {
    if(isEnabled) {
        chart.options.interaction.mode = 'nearest';
    }
    else {
        chart.options.interaction.mode = 'none';
    }
    chart.update();
}

enableDeleteSwitch.addEventListener('change', (event) => {
    const isEnabled = !enableDeleteSwitch.checked;
    updateChartOptionsinteraction(magnitudePlot, isEnabled);
    updateChartOptionsinteraction(phasePlot, isEnabled);
    updateChartOptionsinteraction(nyquistChart, isEnabled);
});

function parseBodePlotData(contents) {
    const isTSV = contents.includes('\t');
    const delimiter = isTSV ? '\t' : ',';

    const lines = contents.split('\n');
    const result = {
        frequencies: [],
        magnitudes: [],
        phases: [],
        unit: 'Hz'
    };

    if(!isTSV) {
        const header = lines[0].split(',');
        if (header[0].includes('rad/s')) {
            result.unit = 'rad/s';
        }
    }

    lines.slice(1).forEach(line => {
        const values = line.split(delimiter);
        if (values.length === 3 && !isNaN(values[0]) && !isNaN(values[1]) && !isNaN(values[2])) {
            const frequency = result.unit === 'rad/s' ? parseFloat(values[0]) / (2 * Math.PI) : parseFloat(values[0]);
            result.frequencies.push(frequency);
            result.magnitudes.push(parseFloat(values[1]));
            result.phases.push(parseFloat(values[2]));
        }
    });

    return result;
}

function redrawBodePlot(data) {
    magnitudePlot.data.labels = [...data.frequencies];
    magnitudePlot.data.datasets[0].data = [...data.magnitudes];
    magnitudePlot.update();

    phasePlot.data.labels = [...data.frequencies];
    phasePlot.data.datasets[0].data = [...data.phases];
    phasePlot.update();

    // Nyquist plot data update based on the new Bode plot data
    nyquistChart.data.labels = [...data.frequencies];
    nyquistChart.data.datasets[0].data = data.frequencies.map((freq, index) => {
        const gain = Math.pow(10, data.magnitudes[index] / 20);
        const phase_rad = data.phases[index] * Math.PI / 180;
        return { x: gain * Math.cos(phase_rad), y: gain * Math.sin(phase_rad) };
    });
    updateNyquistScale(nyquistChart, 1.5);
    nyquistChart.update();
}

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
