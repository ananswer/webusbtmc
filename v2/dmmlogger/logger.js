// The loop of the logger: read all instruments together, at a steady interval. No page needed.
'use strict';

/** Waits `ms`, or less when `signal` is aborted. */
const defaultSleep = (ms, signal) => new Promise((resolve) => {
  if (signal && signal.aborted) {
    resolve();
    return;
  }
  const done = () => {
    clearTimeout(timer);
    signal && signal.removeEventListener('abort', done);
    resolve();
  };
  const timer = setTimeout(done, ms);
  signal && signal.addEventListener('abort', done, { once: true });
});

/**
 * Reads every reader once for each interval until `signal` is aborted.
 *
 *   readers:     [{ read() }] each read() returns a promise of a number (null: over the range)
 *   intervalMs:  time between two readings
 *   onRow(row):  { index, elapsed (seconds from the start), timestamp (milliseconds since 1970),
 *                  results: [{ value } | { error }] } one result for each reader, in order
 *   onSkip(n):   n readings were skipped because the instruments were too slow for the interval
 *
 * The time of a reading is counted from the start, not from the end of the last one, so the
 * interval does not grow with the time a reading takes. When a reading takes longer than the
 * interval the readings that are missed are skipped (an instrument is never asked twice at once).
 * now, wallClock and sleep can be replaced by tests.
 */
export async function runLogger({
  readers, intervalMs, signal, onRow, onSkip = () => { },
  now = () => performance.now(), wallClock = () => Date.now(), sleep = defaultSleep,
}) {
  const start = now();
  const wallStart = wallClock();
  let slot = 0;   // the number of the interval that comes next
  let cycles = 0;
  let skipped = 0;

  while (!signal.aborted) {
    const wait = start + slot * intervalMs - now();
    if (wait > 0) {
      await sleep(wait, signal);
      if (signal.aborted) {
        break;
      }
    }

    const began = now();
    const settled = await Promise.allSettled(readers.map((reader) => reader.read()));
    onRow({
      index: cycles,
      elapsed: (began - start) / 1000,
      timestamp: wallStart + (began - start),
      results: settled.map((result) => (result.status === 'fulfilled' ? { value: result.value } : { error: result.reason })),
    });
    cycles++;

    const next = Math.max(slot + 1, Math.ceil((now() - start) / intervalMs));
    if (next > slot + 1) {
      skipped += next - slot - 1;
      onSkip(next - slot - 1);
    }
    slot = next;
  }
  return { cycles, skipped };
}
