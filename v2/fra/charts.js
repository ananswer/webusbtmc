import { userColors } from './constants.js';
import { state } from './state.js';
import { waveformCtx, lissajousCtx, magnitudeCtx, phaseCtx, nyquistCtx } from './dom.js';

// The charts of the page (Chart.js is loaded by index.html).

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
                order: 2,
                borderWidth: 1,
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y1',
            },
            {
                label: 'Ch1_filtered',
                order: 1,
                borderWidth: 2,
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
                order: 2,
                borderWidth: 1,
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                yAxisID: 'y2',
            },
            {
                label: 'Ch2_filtered',
                order: 1,
                borderWidth: 2,
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
                order: 2,
                borderWidth: 1,
                data: [],
                fill: false,
                showLine: true,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
            {
                label: 'xy_filtered',
                order: 1,
                borderWidth: 2,
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
                        return state.frequencyUnit === 'Hz' ? `${value} Hz` : `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
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
                    color: () => Chart.defaults.borderColor,
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
                        if(state.frequencyUnit === 'Hz') {
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
                        return state.frequencyUnit === 'Hz' ? `${value} Hz` : `${(value * 2 * Math.PI).toFixed(2)} rad/s`;
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
                    color: () => Chart.defaults.borderColor,
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
                        if(state.frequencyUnit === 'Hz') {
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
                        if(state.frequencyUnit === 'Hz') {
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
export const waveformChart = new Chart(waveformCtx, waveformConfig);
export const lissajousChart = new Chart(lissajousCtx, lissajousConfig);
export const magnitudePlot = new Chart(magnitudeCtx, magnitudeConfig);
export const phasePlot = new Chart(phaseCtx, phaseConfig);
export const nyquistChart = new Chart(nyquistCtx, nyquistConfig);

// Chart text and grid follow the theme of the page
function applyChartTheme() {
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--muted').trim();
    const line = css.getPropertyValue('--line').trim();
    Chart.defaults.color = text;
    Chart.defaults.borderColor = line;
    // Existing charts keep the colours they resolved earlier, so set them on each chart.
    for (const chart of [waveformChart, lissajousChart, magnitudePlot, phasePlot, nyquistChart]) {
        for (const scale of Object.values(chart.options.scales)) {
            scale.ticks.color = text;
            scale.grid.color = line;
            scale.title.color = text;
        }
        chart.options.plugins.legend.labels.color = text;
    }

    // Channel colours of an oscilloscope: CH1 and its axis, CH2 and its axis
    const ch1 = css.getPropertyValue('--ch1').trim();
    const ch2 = css.getPropertyValue('--ch2').trim();
    const accent = css.getPropertyValue('--accent').trim();
    // The raw wave is thin and pale, the filtered wave is thick and solid in the same colour.
    const pale = (color) => {
        const hex = color.replace('#', '');
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return `rgba(${r}, ${g}, ${b}, 0.55)`;
    };
    const paint = (dataset, color, isRaw = false) => {
        const shown = isRaw ? pale(color) : color;
        dataset.borderColor = shown;
        dataset.backgroundColor = shown;   // the colour box of the legend
        dataset.pointBackgroundColor = shown;
    };
    const [wave1, wave1Filtered, wave2, wave2Filtered] = waveformChart.data.datasets;
    paint(wave1, ch1, true);
    paint(wave1Filtered, ch1);
    paint(wave2, ch2, true);
    paint(wave2Filtered, ch2);
    for (const [axis, color] of [['y1', ch1], ['y2', ch2]]) {
        waveformChart.options.scales[axis].ticks.color = color;
        waveformChart.options.scales[axis].title.color = color;
    }
    const [xy, xyFiltered] = lissajousChart.data.datasets;
    paint(xy, accent, true);
    paint(xyFiltered, accent);
    paint(nyquistChart.data.datasets[0], accent);

    for (const chart of [waveformChart, lissajousChart, magnitudePlot, phasePlot, nyquistChart]) {
        chart.update('none');
    }
}
applyChartTheme();
window.addEventListener('tmc-themechange', applyChartTheme);

export function updateNyquistScale(chart, limit) {
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

export function redrawBodePlot(data) {
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

// Hz or rad/s on the frequency axes (the data stay in Hz)
export function setFrequencyUnit(unit) {
    state.frequencyUnit = unit;
    magnitudePlot.options.scales.x.title.text = `Frequency (${unit})`;
    phasePlot.options.scales.x.title.text = `Frequency (${unit})`;
}
