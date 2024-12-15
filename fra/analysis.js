function removeOffset(wave) {
    // Calculate the mean of the wave data
    const mean = wave.reduce((acc, val) => acc + val, 0) / wave.length;
    
    // Subtract the mean from each data point to remove the offset
    const correctedWave = wave.map(val => val - mean);
    
    return correctedWave;
}

function calculateMedian(values) {
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    let half = Math.floor(values.length / 2);
    if (values.length % 2) {
        return values[half];
    } else {
        return (values[half - 1] + values[half]) / 2.0;
    }
}

function averagePairs(values) {
    let result = [];
    let length = values.length;
    length = length % 2 !== 0 ? length - 1 : length;

    for (let i = 0; i < length; i += 2) {
        let pairSum = values[i];
        pairSum += values[i + 1];
        let pairAverage = pairSum / 2;
        result.push(pairAverage);
    }

    return result;
}

function findPhaseDifference(waveA, waveB, ts) {
    // Check if both waveforms have the same length
    if (waveA.length !== waveB.length) {
        return { gain: NaN, freq: NaN, phase_rad: NaN };
    }

    waveA = removeOffset(waveA);
    waveB = removeOffset(waveB);

    // Initialize arrays to store amplitudes and periods
    let waveA_amplitudes = [];
    let waveB_amplitudes = [];
    let periods = [];
    let phaseDifferences = [];
    const length = waveA.length;

    // Initialize variables for zero-crossing detection and RMS calculation
    let waveA_polarity = 0;
    let prevWaveA_polarity = 0;

    let waveB_polarity = 0;
    let prevWaveB_polarity = 0;

    let found_zeroCrossing = false;

    let waveA_sumSquares_P = 0;
    let waveB_sumSquares_P = 0;
    let periodCounter = 0;
    let phaseCounter = 0;

    for (let i = 0; i < length; i++) {
        // Determine current polarity of waveA
        prevWaveA_polarity = waveA_polarity;
        waveA_polarity = (waveA[i] > 0) ? 1 : -1;

        // Determine current polarity of waveB
        prevWaveB_polarity = waveB_polarity;
        waveB_polarity = (waveB[i] > 0) ? 1 : -1;


        // Detect zero-crossings of waveA to calculate periods and amplitudes
        let waveA_zeroCrossing = 0;
        if ((waveA_polarity + prevWaveA_polarity) === 0) {
            if (waveA_polarity === 1) {
                waveA_zeroCrossing = 1; // positive edge
            } else {
                waveA_zeroCrossing = -1; // negative edge
            }
        }

        if(!found_zeroCrossing) {
            if(waveA_zeroCrossing === 1) {
                found_zeroCrossing = true;
            }
            else {
                continue;
            }
        }

        // Count phase differences between waveA and waveB
        if (waveA_polarity * waveB_polarity < 0) {
            phaseCounter++;
        } else {
            if (phaseCounter > 0) {
                if (waveA_polarity * prevWaveA_polarity > 0) {
                    phaseDifferences.push(-phaseCounter);
                } else if (waveB_polarity * prevWaveB_polarity > 0) {
                    phaseDifferences.push(phaseCounter);
                }
            }
            phaseCounter = 0;
        }

        // On zero-crossing of waveA, calculate RMS and reset counters
        if (waveA_zeroCrossing === 1 && periodCounter > 0) {
            waveA_amplitudes.push(Math.sqrt(waveA_sumSquares_P / periodCounter));
            waveB_amplitudes.push(Math.sqrt(waveB_sumSquares_P / periodCounter));
            periods.push(periodCounter);
            waveA_sumSquares_P = 0;
            waveB_sumSquares_P = 0;
            periodCounter = 0;
        }

        // Accumulate squares of waveform values for RMS calculation
        waveA_sumSquares_P += waveA[i] * waveA[i];
        waveB_sumSquares_P += waveB[i] * waveB[i];
        periodCounter++;

    }

    // Calculate median values for amplitude, period, and phase difference
    const waveA_ampl = calculateMedian(waveA_amplitudes);
    const waveB_ampl = calculateMedian(waveB_amplitudes);
    const gain = waveB_ampl / waveA_ampl;
    
    periodCounter = calculateMedian(periods);
    const freq = 1 / (periodCounter * ts);

    // Calculating the average of the counts measured on the positive polarity side and the negative polarity side of the sine wave.
    phaseDifferences = averagePairs(phaseDifferences);

    phaseCounter = calculateMedian(phaseDifferences);
    const phase_time = phaseCounter * ts;
    const phase_rad = (2 * Math.PI * freq) * phase_time;

    // Return calculated values
    return { gain: gain, freq: freq, phase_rad: phase_rad };
}
