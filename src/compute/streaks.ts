/** Streak math over the merged daily contribution series. */

import type { DateRange, DayContribution, Streaks } from '../model.js';

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`invalid calendar date: ${date}`);
  return ms;
}

/** One maximal run of consecutive active days. */
interface Run {
  readonly start: string;
  readonly end: string;
  /** UTC midnight of `end` — run adjacency and the current-streak anchor compare on this. */
  readonly endMs: number;
  readonly length: number;
}

/** Split the series' active days into runs of consecutive dates, in order. */
function activeRuns(days: readonly DayContribution[]): readonly Run[] {
  return days
    .filter((day) => day.count > 0)
    .reduce<readonly Run[]>((runs, day) => {
      const ms = toUtcMs(day.date);
      const last = runs.at(-1);
      if (last !== undefined && ms - last.endMs === DAY_MS) {
        return [...runs.slice(0, -1), { ...last, end: day.date, endMs: ms, length: last.length + 1 }];
      }
      return [...runs, { start: day.date, end: day.date, endMs: ms, length: 1 }];
    }, []);
}

function toRange(run: Run | undefined): DateRange | undefined {
  return run === undefined ? undefined : { start: run.start, end: run.end };
}

/**
 * Compute current and longest streaks with their date ranges.
 *
 * `days` must be ascending and date-unique (mergeDailySeries guarantees both).
 * The "today" anchor is the series' last day, so results do not depend on the
 * generator host's clock or timezone. A current streak stays alive when the
 * last day has no contributions yet (the day is not over — GitHub streak
 * convention): the anchor then moves to the day before, so only a run ending
 * there still counts.
 */
export function computeStreaks(days: readonly DayContribution[]): Streaks {
  const runs = activeRuns(days);

  // Strict > keeps the earliest run on ties, matching the walk it replaced.
  const longestRun = runs.reduce<Run | undefined>(
    (best, run) => (run.length > (best?.length ?? 0) ? run : best),
    undefined
  );

  const last = days.at(-1);
  const anchorMs =
    last === undefined ? Number.NaN : last.count === 0 ? toUtcMs(last.date) - DAY_MS : toUtcMs(last.date);
  const currentRun = runs.find((run) => run.endMs === anchorMs);

  return {
    current: currentRun?.length ?? 0,
    longest: longestRun?.length ?? 0,
    currentRange: toRange(currentRun),
    longestRange: toRange(longestRun),
  };
}
