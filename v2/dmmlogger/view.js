// Which part of a long recording the chart shows. No page needed.
'use strict';

// [seconds, label]; null is the whole recording.
export const WINDOWS = [[30, '30 s'], [60, '1 min'], [300, '5 min'], [600, '10 min'], [1800, '30 min'], [3600, '1 h'], [21600, '6 h'], [null, 'All']];
export const DEFAULT_WINDOW = 60;

/**
 * The part of the time axis to show, and the slider that moves it.
 *
 *   total   the time of the newest reading in seconds (0 when there is none)
 *   size    the length of the window in seconds, null for the whole recording
 *   start   where the window begins (used when it does not follow)
 *   follow  true: the window ends at the newest reading
 *
 * Returns { min, max } for the time axis and slider: { last, value }, the furthest start and the
 * start that is shown. While the recording is shorter than the window the axis is as long as the
 * window, so the readings come in from the left and the chart does not jump.
 */
export function viewBounds({ total, size, start = 0, follow = false }) {
  if (size === null || size === undefined) {
    return { min: 0, max: Math.max(total, 1), slider: { last: 0, value: 0 } };
  }
  const last = Math.max(0, total - size);
  const from = follow ? last : Math.min(Math.max(start, 0), last);
  return { min: from, max: from + size, slider: { last, value: from } };
}
