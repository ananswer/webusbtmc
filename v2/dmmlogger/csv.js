// The CSV file of the logger: how it is written and how it is read again. No page needed.
//
//   Time (s),Date and time,Supply (V),Load (A)
//   0.000,2026-10-23T17:15:30.123+09:00,5.00012,0.20031
//   1.000,2026-10-23T17:15:31.124+09:00,5.00010,
//
// The first column is the time in seconds from the start. The second is the clock time. Every
// other column is one DMM, named “name (unit)”. An empty cell is a reading that failed or was over
// the range.
'use strict';

const TIME_HEADER = 'Time (s)';
const CLOCK_HEADER = 'Date and time';

function quote(cell) {
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** 1761207330123 as “2026-10-23T17:15:30.123+09:00” (the local time of the computer). */
export function isoLocal(milliseconds) {
  const date = new Date(milliseconds);
  const pad = (n, width = 2) => String(Math.abs(n)).padStart(width, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** 1761207330123 as “20261023-171530” (the local time), for the name of a file. */
export function fileStamp(milliseconds) {
  return isoLocal(milliseconds).slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
}

/**
 * columns: [{ name, unit }] one for each DMM
 * rows:    [{ elapsed (seconds), timestamp (milliseconds since 1970), values: [number | null] }]
 */
export function buildCsv(columns, rows) {
  const header = [TIME_HEADER, CLOCK_HEADER, ...columns.map(({ name, unit }) => `${name} (${unit})`)];
  const lines = [header.map(quote).join(',')];
  for (const row of rows) {
    const cells = [row.elapsed.toFixed(3), isoLocal(row.timestamp), ...row.values.map((value) => (value === null || value === undefined ? '' : String(value)))];
    lines.push(cells.map(quote).join(','));
  }
  return lines.join('\n') + '\n';
}

/** The cells of a CSV text (quotes, doubled quotes and line breaks inside quotes are handled). */
function splitCsv(text) {
  const records = [];
  let record = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      record.push(cell);
      cell = '';
      records.push(record);
      record = [];
    } else {
      cell += char;
    }
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  return records.filter((cells) => cells.some((c) => c.trim() !== ''));
}

/** “Supply (V)” as { name: 'Supply', unit: 'V' }. */
function parseColumnName(header) {
  const match = /^(.*) \(([^()]*)\)$/.exec(header.trim());
  return match ? { name: match[1], unit: match[2] } : { name: header.trim(), unit: '' };
}

/**
 * Reads the text of a file of the logger.
 * Returns { columns: [{ name, unit }], rows: [{ elapsed, timestamp | null, values: [number | null] }] }
 * Throws an Error with a message for the user when the file is not a file of the logger.
 */
export function parseCsv(text) {
  const records = splitCsv(text.replace(/^﻿/, ''));
  if (records.length === 0) {
    throw new Error('The file is empty.');
  }

  const header = records[0].map((cell) => cell.trim());
  const timeIndex = header.findIndex((cell) => cell.toLowerCase() === TIME_HEADER.toLowerCase());
  if (timeIndex < 0) {
    throw new Error(`This is not a file of the logger: the first line has no “${TIME_HEADER}” column.`);
  }
  const clockIndex = header.findIndex((cell) => cell.toLowerCase() === CLOCK_HEADER.toLowerCase());
  const valueIndexes = header.map((_, i) => i).filter((i) => i !== timeIndex && i !== clockIndex);
  if (valueIndexes.length === 0) {
    throw new Error('The file has no column with readings.');
  }

  const rows = [];
  for (const cells of records.slice(1)) {
    const elapsed = Number(cells[timeIndex]);
    if (cells[timeIndex] === undefined || cells[timeIndex].trim() === '' || !Number.isFinite(elapsed)) {
      continue;   // a line that is not a reading
    }
    const clock = clockIndex >= 0 ? Date.parse(cells[clockIndex]) : NaN;
    rows.push({
      elapsed,
      timestamp: Number.isNaN(clock) ? null : clock,
      values: valueIndexes.map((i) => {
        const cell = (cells[i] ?? '').trim();
        const value = cell === '' ? NaN : Number(cell);
        return Number.isFinite(value) ? value : null;
      }),
    });
  }
  return { columns: valueIndexes.map((i) => parseColumnName(header[i])), rows };
}

/** Smallest, largest and mean of a list of readings (null is ignored). */
export function summarize(values) {
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    count++;
    sum += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return count === 0 ? { count: 0, min: null, max: null, mean: null } : { count, min, max, mean: sum / count };
}
