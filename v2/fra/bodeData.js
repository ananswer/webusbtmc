// Plot data and waveforms as the text of the files that can be saved or loaded. No page needed.

export function processBodeData(freqs, dataA, dataB) {
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

export function createLTspiceSubcktContent(data,file_name) {
    let contents = `.subckt ${file_name} 1 2\n`;
    contents += `E 2 0 FREQ {V(1,0)} =\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        contents += `+(${data.frequencies[i].toExponential(14)},${data.magnitudes[i].toExponential(14)},${data.phases[i].toExponential(14)})\n`;
    }
    contents += `.ends`;
    return contents;
}

export function createBodeCSVContent(data, unit) {
    let csvContent = `Frequency (${unit}),Magnitude (dB),Phase (degrees)\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        const frequency = unit === 'rad/s' ? data.frequencies[i] * 2 * Math.PI : data.frequencies[i];
        csvContent += `${frequency},${data.magnitudes[i]},${data.phases[i]}\n`;
    }
    return csvContent;
}

export function createBodeTSVContent(data) {
    let contents = `Frequency\tMagnitude\tPhase\n`;
    for (let i = 0; i < data.frequencies.length; i++) {
        contents += `${data.frequencies[i]}\t${data.magnitudes[i]}\t${data.phases[i]}\n`;
    }
    return contents;
}

export function createCSVContent(times, a, b, c, d) {
    let csvContent = 'Time(s),Ch1_raw,Ch1_filtered,Ch2_raw,Ch2_filtered\n';
    for (let i = 0; i < times.length; i++) {
        csvContent += `${times[i]},${a[i]},${b[i]},${c[i]},${d[i]}\n`;
    }
    return csvContent;
}

export function createTSVContent(times, a, b, c, d) {
    let tsvContent = 'Time\tCh1_raw\tCh1_filtered\tCh2_raw\tCh2_filtered\n';
    for (let i = 0; i < times.length; i++) {
        tsvContent += `${times[i]}\t${a[i]}\t${b[i]}\t${c[i]}\t${d[i]}\n`;
    }
    return tsvContent;
}

export function parseBodePlotData(contents) {
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
