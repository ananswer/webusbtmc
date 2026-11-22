// What the logger needs to know about a DMM: the measurements, how to set one up and how to read
// a value. Nothing here touches the page. An `instrument` is anything with
// write(text) and query(text) that return promises (the Webusbtmc class of the driver).
'use strict';

// The measurements. `scpi` is the function in the commands (CONF:VOLT:DC ...), `auto` what follows
// it for the automatic range ('' when the command has no such argument), `nplc` tells whether
// the integration time is set in power line cycles for it. `unit` goes to the CSV file (ASCII
// only), `symbol` is shown in the page.
export const MEASUREMENTS = {
  dcv: { label: 'DC voltage', scpi: 'VOLT:DC', auto: 'AUTO', nplc: true, unit: 'V', symbol: 'V' },
  acv: { label: 'AC voltage', scpi: 'VOLT:AC', auto: 'AUTO', nplc: false, unit: 'V', symbol: 'V' },
  dci: { label: 'DC current', scpi: 'CURR:DC', auto: 'AUTO', nplc: true, unit: 'A', symbol: 'A' },
  aci: { label: 'AC current', scpi: 'CURR:AC', auto: 'AUTO', nplc: false, unit: 'A', symbol: 'A' },
  res: { label: 'Resistance (2-wire)', scpi: 'RES', auto: 'AUTO', nplc: true, unit: 'Ohm', symbol: 'Ω' },
  freq: { label: 'Frequency', scpi: 'FREQ', auto: '', nplc: false, unit: 'Hz', symbol: 'Hz' },
  cap: { label: 'Capacitance', scpi: 'CAP', auto: '', nplc: false, unit: 'F', symbol: 'F' },
};

// How a DMM is told what to do. The standard SCPI commands are the ones of the DMMs of Keysight
// (Agilent). A maker that needs other commands gets a profile of its own (see SUPPORTED_VENDORS);
// nothing else in the page depends on the commands.
export const STANDARD_SCPI = {
  name: 'Standard SCPI',
  clear: '*CLS',
  errorQuery: 'SYST:ERR?',
  readQuery: 'READ?',
  configQuery: 'CONF?',
  /** The command that sets a measurement up; `range` is a number, or null for the automatic range. */
  configure(measurement, range = null) {
    const argument = range !== null && range !== undefined ? ` ${range}` : (measurement.auto ? ` ${measurement.auto}` : '');
    return `CONF:${measurement.scpi}${argument}`;
  },
  /** The command for the integration time in power line cycles. */
  nplc(measurement, value) {
    return `${measurement.scpi}:NPLC ${value}`;
  },
  nplcQuery(measurement) {
    return `${measurement.scpi}:NPLC?`;
  },
};

// The makers whose DMMs have been tried, by the vendor ID of the USB device. The dialog of the browser
// offers only their instruments and the page refuses any other one. A maker that is added here, with the
// profile of its commands, is offered and used; nothing else in the page has to change.
export const SUPPORTED_VENDORS = {
  0x0957: { name: 'Keysight (Agilent)', profile: STANDARD_SCPI },
};

/** The profile for a USB vendor ID, or null when the maker has not been tried. */
export function profileForVendor(vendorId) {
  const vendor = SUPPORTED_VENDORS[vendorId];
  return vendor ? vendor.profile : null;
}

/** The names of the supported makers, for a message. */
export function supportedMakers() {
  return Object.values(SUPPORTED_VENDORS).map((vendor) => vendor.name).join(', ');
}

/** The filters for the dialog of the browser: USBTMC instruments of the supported makers. */
export function deviceFilters() {
  return Object.keys(SUPPORTED_VENDORS).map((vendorId) => ({ vendorId: Number(vendorId), classCode: 0xFE, subclassCode: 0x03, protocolCode: 0x01 }));
}

// A DMM answers 9.9E37 when the input is over the range.
const OVERLOAD_LIMIT = 9e37;

/**
 * The number in the answer of READ?. Returns null for an overload.
 * Throws when the answer is not a number.
 */
export function parseReading(answer) {
  const first = String(answer).split(',')[0].trim();
  const value = Number(first);
  if (first === '' || !Number.isFinite(value)) {
    throw new Error(`The instrument answered “${String(answer).trim()}”, not a number.`);
  }
  return Math.abs(value) >= OVERLOAD_LIMIT ? null : value;
}

/** The answer of *IDN? as { maker, model, serial, firmware }. */
export function parseIdn(answer) {
  const [maker = '', model = '', serial = '', firmware = ''] = String(answer).trim().split(',').map((part) => part.trim());
  return { maker, model, serial, firmware };
}

/** The answer of CONF? (“VOLT +1.00000E+01,+1.5E-06”) as { function, range, resolution }, or null. */
export function parseConfig(answer) {
  const match = /^"?\s*([A-Z:]+)\s+([+-]?[\d.]+(?:E[+-]?\d+)?)\s*,\s*([+-]?[\d.]+(?:E[+-]?\d+)?)/i.exec(String(answer).trim());
  return match ? { function: match[1], range: Number(match[2]), resolution: Number(match[3]) } : null;
}

const PREFIXES = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];

/** 0.0234 and 'V' give “23.4000 mV”: six digits with the prefix that fits. */
export function formatReading(value, symbol) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value === 0) {
    return `0.00000 ${symbol}`;
  }
  const [scale, prefix] = PREFIXES.find(([limit]) => Math.abs(value) >= limit) || PREFIXES[PREFIXES.length - 1];
  return `${(value / scale).toPrecision(6)} ${prefix}${symbol}`;
}

/** 0.1 and 'V' give “100 mV”, 10000 and 'Ω' give “10 kΩ”: three digits at most. */
export function formatRange(value, symbol) {
  if (value === 0) {
    return `0 ${symbol}`;
  }
  const [scale, prefix] = PREFIXES.find(([limit]) => Math.abs(value) >= limit) || PREFIXES[PREFIXES.length - 1];
  return `${Number((value / scale).toPrecision(3))} ${prefix}${symbol}`;
}

/** 75 seconds as “1:15”, 3725 seconds as “1:02:05” (the hours can be more than 24). */
export function formatDuration(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** Reads the errors of the instrument until the queue is empty (at most `limit`). */
async function readErrors(instrument, profile, limit = 5) {
  const errors = [];
  for (let i = 0; i < limit; i++) {
    const answer = (await instrument.query(profile.errorQuery)).trim();
    if (/^[+-]?0\b/.test(answer)) {
      break;
    }
    errors.push(answer);
  }
  return errors;
}

/**
 * Sets a measurement up, and the range and the integration time when they are given.
 *
 *   settings: { range: number | null (automatic), nplc: number | null (the default of the DMM) }
 *
 * Each setting is sent alone and the error queue is read after it, so the answer tells which one the
 * DMM did not accept. The measurement is always set up with the automatic range first (this also
 * puts everything else back to the defaults), the range and the integration time follow.
 *
 * Returns { ok, errors, results: [{ setting: 'measurement' | 'range' | 'nplc', command, ok, errors }] }.
 * A setting that does not exist for the measurement (NPLC of an AC voltage) is { skipped: true }.
 */
export async function configure(instrument, measurementKey, { range = null, nplc = null } = {}, profile = STANDARD_SCPI) {
  const measurement = MEASUREMENTS[measurementKey];
  if (!measurement) {
    throw new Error(`Unknown measurement: ${measurementKey}`);
  }

  const results = [];
  const send = async (setting, command) => {
    await instrument.write(command);
    const errors = await readErrors(instrument, profile);
    results.push({ setting, command, ok: errors.length === 0, errors });
  };

  await instrument.write(profile.clear);
  await send('measurement', profile.configure(measurement, null));
  if (range !== null) {
    await send('range', profile.configure(measurement, range));
  }
  if (nplc !== null) {
    if (measurement.nplc) {
      await send('nplc', profile.nplc(measurement, nplc));
    } else {
      results.push({ setting: 'nplc', command: null, ok: false, skipped: true, errors: [] });
    }
  }
  return { ok: results.every((result) => result.ok), errors: results.flatMap((result) => result.errors), results };
}

/**
 * The settings that the DMM has now: { range, resolution } of CONF?, and `nplc` when `withNplc`
 * (only ask for it when it was set: a DMM without NPLC does not answer the query).
 */
export async function readSettings(instrument, measurementKey, { withNplc = false } = {}, profile = STANDARD_SCPI) {
  const measurement = MEASUREMENTS[measurementKey];
  const config = parseConfig(await instrument.query(profile.configQuery));
  const settings = { range: config ? config.range : null, resolution: config ? config.resolution : null, nplc: null };
  if (withNplc && measurement.nplc) {
    const value = Number(await instrument.query(profile.nplcQuery(measurement)));
    settings.nplc = Number.isFinite(value) ? value : null;
  }
  return settings;
}

/** One reading: a number, or null for an overload. */
export async function readValue(instrument, timeout = 10000, profile = STANDARD_SCPI) {
  return parseReading(await instrument.query(profile.readQuery, 1024, timeout));
}
