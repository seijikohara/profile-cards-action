/** Streak math over the merged daily contribution series. */

import type { DateRange, DayContribution, Streaks } from '../model.js';

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`invalid calendar date: ${date}`);
  return ms;
}

/**
 * Compute current and longest streaks with their date ranges.
 *
 * `days` must be ascending and date-unique (mergeDailySeries guarantees both).
 * The "today" anchor is the series' last day, so results do not depend on the
 * generator host's clock or timezone. A current streak stays alive when the
 * last day has no contributions yet (the day is not over — GitHub streak
 * convention).
 */
export function computeStreaks(days: readonly DayContribution[]): Streaks {
  let longest = 0;
  let longestRange: DateRange | undefined;
  let run = 0;
  let runStart = '';
  let lastActiveMs = Number.NaN;
  for (const day of days) {
    if (day.count === 0) continue;
    const ms = toUtcMs(day.date);
    if (ms - lastActiveMs === DAY_MS) {
      run += 1;
    } else {
      run = 1;
      runStart = day.date;
    }
    lastActiveMs = ms;
    if (run > longest) {
      longest = run;
      longestRange = { start: runStart, end: day.date };
    }
  }

  // Current streak: walk back from the end; forgive the final day if zero —
  // but anchor continuity to it, so a gap before the forgiven day still ends
  // the streak.
  let index = days.length - 1;
  const last = days[index];
  let current = 0;
  let currentRange: DateRange | undefined;
  let expectedMs = Number.NaN;
  if (last !== undefined && last.count === 0) {
    index -= 1;
    expectedMs = toUtcMs(last.date) - DAY_MS;
  }
  for (; index >= 0; index -= 1) {
    const day = days[index];
    if (day === undefined || day.count === 0) break;
    const ms = toUtcMs(day.date);
    if (!Number.isNaN(expectedMs) && ms !== expectedMs) break;
    current += 1;
    currentRange = { start: day.date, end: currentRange?.end ?? day.date };
    expectedMs = ms - DAY_MS;
  }

  return { current, longest, currentRange, longestRange };
}
