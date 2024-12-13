function lpf1stOrder(values, cutOffFreq, ts) {
    let filtered = [];
    if (values.length === 0) {
        return { raw: values, filtered: filtered  };
    }

    // zero order hold
    const tau = 1/(2 * Math.PI * cutOffFreq);
    const k = 1 - Math.exp(-ts/tau);

    filtered.push(values[0]);
    for (let i = 1; i < values.length; i++) {
        filtered[i] = k * values[i] + (1 - k) * filtered[i - 1]
    }

    // Remove initial data points corresponding to 5 times the filter time constant.
    // This ensures the filter's output has reached a stable state, improving analysis accuracy.
    const count = Math.floor((5 * tau) / ts);
    filtered = filtered.slice(count);
    values = values.slice(count);

    return { raw: values, filtered: filtered  };
}

function build_xy(ch1_data, ch2_data) {
    return ch1_data.map((x, i) => ({ x: x, y: ch2_data[i] }));
}