/** Rolling twelve-month contribution totals over an account's whole history. */

import { range } from '../iter.js';
import type { DayContribution, YearActivity } from '../model.js';

/** Days in the rolling window. A fixed 365 keeps every sample comparable. */
const WINDOW_DAYS = 365;

/** Days between samples. Weekly is dense enough to draw and cheap enough to keep. */
const SAMPLE_STEP = 7;

const DAY_MS = 86_400_000;

export interface MomentumPoint {
  /** Last day of the window, ISO. */
  readonly date: string;
  /** Contributions in the 365 days ending on `date`. */
  readonly total: number;
}

export interface MomentumData {
  /** Weekly samples, oldest first. Empty when the history is shorter than the window. */
  readonly points: readonly MomentumPoint[];
  /** The highest sample; ties resolve to the earliest. */
  readonly peak: MomentumPoint | undefined;
  /** The newest sample — today's trailing-year total. */
  readonly current: MomentumPoint | undefined;
  /** The first day that actually carried a contribution. */
  readonly since: string | undefined;
  /** Contributions over the whole history. */
  readonly lifetimeTotal: number;
  /** The leanest complete calendar year. Undefined until one has finished. */
  readonly quietestYear: { readonly year: number; readonly total: number } | undefined;
}

function dateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Roll a daily contribution series into weekly trailing-year totals.
 *
 * A cumulative total only ever rises, so it flatters every history equally: a
 * dead year still slopes upward. A trailing-365-day sum is the same data drawn
 * so that it can fall, which is the only way this deck can say output is
 * declining.
 *
 * The first window ends 365 days after the first contribution. Sampling before
 * that would divide by a partial window and manufacture a rise out of the
 * account simply existing for longer.
 */
export function computeMomentum(days: readonly DayContribution[], years: readonly YearActivity[] = []): MomentumData {
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  const lifetimeTotal = days.reduce((sum, day) => sum + day.count, 0);
  if (first === undefined || last === undefined) {
    return {
      points: [],
      peak: undefined,
      current: undefined,
      since: undefined,
      lifetimeTotal,
      quietestYear: undefined,
    };
  }

  // Densify: the calendar skips no days, but a merged multi-year series can,
  // and a sliding window has to step one real day at a time.
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const startMs = Date.parse(`${first}T00:00:00Z`);
  const span = Math.round((Date.parse(`${last}T00:00:00Z`) - startMs) / DAY_MS) + 1;
  const counts = range(span).map((offset) => byDate.get(dateStr(startMs + offset * DAY_MS)) ?? 0);

  // prefix[i] is the total of the first i days, so any window is one subtraction.
  const prefix: number[] = [0];
  for (const count of counts) prefix.push((prefix.at(-1) ?? 0) + count);
  const windowEndingAt = (index: number): number =>
    (prefix[index + 1] ?? 0) - (prefix[Math.max(0, index + 1 - WINDOW_DAYS)] ?? 0);

  // Walk backwards from the newest day so the last sample is always today, and
  // reverse: a forward walk would leave a ragged gap at the right edge, which
  // is the end a reader looks at first.
  const oldest = WINDOW_DAYS - 1;
  const points: MomentumPoint[] =
    span <= oldest
      ? []
      : range(Math.floor((span - 1 - oldest) / SAMPLE_STEP) + 1)
          .map((step) => {
            const index = span - 1 - step * SAMPLE_STEP;
            return { date: dateStr(startMs + index * DAY_MS), total: windowEndingAt(index) };
          })
          .toReversed();

  const peak = points.reduce<MomentumPoint | undefined>(
    (best, point) => (best === undefined || point.total > best.total ? point : best),
    undefined
  );

  // Only fully covered years can be compared. Both ends of a history are
  // partial unless they happen to fall on a year boundary, and a partial year
  // wins "quietest" on length alone.
  const firstComplete = first.slice(5) === '01-01' ? Number(first.slice(0, 4)) : Number(first.slice(0, 4)) + 1;
  const lastComplete = last.slice(5) === '12-31' ? Number(last.slice(0, 4)) : Number(last.slice(0, 4)) - 1;
  const quietestYear = years
    .filter((year) => year.year >= firstComplete && year.year <= lastComplete)
    .reduce<{ year: number; total: number } | undefined>(
      (best, year) => (best === undefined || year.total < best.total ? { year: year.year, total: year.total } : best),
      undefined
    );

  // The calendar starts each year on January 1 whether or not anything
  // happened, so the first day IN the series is not the first day OF the work.
  const since = days.find((day) => day.count > 0)?.date ?? first;

  return { points, peak, current: points.at(-1), since, lifetimeTotal, quietestYear };
}
