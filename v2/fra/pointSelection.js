import { markPlotsChanged } from './state.js';
import {
    enableDeleteSwitch, magnitudeCtx, phaseCtx, nyquistCtx, magnitudeCanvas, phaseCanvas, nyquistCanvas,
} from './dom.js';
import { magnitudePlot, phasePlot, nyquistChart } from './charts.js';

// Delete points of the plots: click one point, or drag a rectangle around several.

let isDragging = false;
let startPoint = { x: 0, y: 0 };
let endPoint = { x: 0, y: 0 };
let savedImageMagnitudeData;
let savedImagePhaseData;
let savedImageNyquistData;

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
    markPlotsChanged();
    chart.data.labels.splice(index, 1);
    chart.data.datasets[0].data.splice(index, 1);
}

function getElementAtEvent(chart, event) {
    return chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
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

function handleClick(event) {
    let selectedDataPointIndex = null;

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

export function setupPointSelection() {
    // Chart click handlers for data deletion
    magnitudeCtx.canvas.onclick = handleClick;
    phaseCtx.canvas.onclick = handleClick;
    nyquistCtx.canvas.onclick = handleClick;

    // Setup canvas event listeners for data selection
    setupCanvasEventListeners(magnitudeCanvas, magnitudeCtx, magnitudePlot, savedImageMagnitudeData, startPoint, endPoint);
    setupCanvasEventListeners(phaseCanvas, phaseCtx, phasePlot, savedImagePhaseData, startPoint, endPoint);
    setupCanvasEventListeners(nyquistCanvas, nyquistCtx, nyquistChart, savedImageNyquistData, startPoint, endPoint);

    enableDeleteSwitch.addEventListener('change', () => {
        const isEnabled = !enableDeleteSwitch.checked;
        updateChartOptionsinteraction(magnitudePlot, isEnabled);
        updateChartOptionsinteraction(phasePlot, isEnabled);
        updateChartOptionsinteraction(nyquistChart, isEnabled);
    });
}
