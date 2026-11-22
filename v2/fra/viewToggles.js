// Show and hide the charts.

export function handleToggleLissajousChartClick() {
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

export function handleToggleNyquistPlotClick() {
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

export function handleToggleChartClick() {
    toggleVisibility(document.getElementById('chartContainer'));
}

export function handleTogglePlotClick() {
    toggleVisibility(document.getElementById('plotContainer'));
}
