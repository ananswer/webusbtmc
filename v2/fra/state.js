import GetCurve from './getCurve.js';

// What the modules of this page share.
export const state = {
    worker: new GetCurve(),
    frequencyUnit: 'Hz',            // 'Hz' or 'rad/s'
    lastAnalysed: null,             // the numbers of the newest measurement
    isFetchDataInterval: false,     // auto fetch is running
    tsvOnWaveform: false,           // save the waveforms as TSV instead of CSV
    tsvOnBode: false,               // save the plot data as TSV instead of CSV
    subcktNumber: 1,                // number in the name of the next LTspice file
    plotsSaved: true,               // the plots were exported, copied or loaded from a file
};

export const markPlotsChanged = () => { state.plotsSaved = false; };
export const markPlotsSaved = () => { state.plotsSaved = true; };
