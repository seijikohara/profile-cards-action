/** Lifetime weekly heatmap: a "wall of years" of per-week activity levels. */

import type { DayContribution } from '../model.js';

export interface LifetimeYear {
  readonly year: number;
  /** Level 0..4 per week bucket; length is the number of week buckets that year (<= 53). */
  readonly weeks: readonly (0 | 1 | 2 | 3 | 4)[];
}

export interface LifetimeData {
  readonly years: readonly LifetimeYear[]; // ascending by year
  /** The weekly-sum thresholds used for leveling (for reference/testing). */
  readonly thresholds: readonly [number, number, number, number]; // q1..q4 lower bounds
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Bucket {
  readonly year: number;
  /** floor((ordinalDayOfYear - 1) / 7), where Jan 1 has ordinal 1. Range 0..52. */
  readonly weekIndex: number;
}

/**
 * Map an ISO "YYYY-MM-DD" date to its (year, weekIndex) bucket.
 *
 * The ordinal day-of-year comes from a UTC millisecond difference with explicit
 * arguments, so the result never depends on the host clock or timezone and
 * accounts for leap years automatically (Feb 29 shifts every later ordinal by
 * one in a leap year).
 */
function bucketOf(date: string): Bucket {
  const match = ISO_DATE.exec(date);
  if (match === null) throw new Error(`invalid calendar date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayOfMonth = Number(match[3]);
  const ordinal = (Date.UTC(year, month - 1, dayOfMonth) - Date.UTC(year, 0, 1)) / DAY_MS + 1;
  const weekIndex = Math.floor((ordinal - 1) / 7);
  return { year, weekIndex };
}

/**
 * Value at percentile `p` of a non-empty ascending array using nearest-rank on a
 * 0-based index (clamped to the last element).
 */
function quantile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[index] ?? 0;
}

/**
 * Compute the four leveling lower bounds from the distribution of NON-ZERO
 * weekly sums.
 *
 * Given the non-zero sums sorted ascending as S (length n), the thresholds are:
 *   q1 = S[0]               -> minimum non-zero sum (floor of level 1)
 *   q2 = S[floor(0.25 * n)] -> 25th-percentile cut (floor of level 2)
 *   q3 = S[floor(0.50 * n)] -> 50th-percentile cut (floor of level 3)
 *   q4 = S[floor(0.75 * n)] -> 75th-percentile cut (floor of level 4)
 *
 * They are non-decreasing (q1 <= q2 <= q3 <= q4). An empty distribution yields
 * all zeros, which pairs with the leveling rule to keep every week at level 0.
 */
function computeThresholds(sorted: readonly number[]): [number, number, number, number] {
  if (sorted.length === 0) return [0, 0, 0, 0];
  return [sorted[0] ?? 0, quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
}

/**
 * Level a weekly sum against the thresholds.
 *
 * The level is the count of thresholds `t` with `t <= sum`, and 0 when the sum
 * is 0. Because q1 is the minimum non-zero sum, every positive week reaches at
 * least level 1 and the top quartile (sum >= q4) reaches level 4. The cascade
 * below implements that count directly and is monotonic in the weekly sum.
 */
function levelOf(sum: number, thresholds: readonly [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  const [q1, q2, q3, q4] = thresholds;
  if (sum <= 0 || sum < q1) return 0;
  if (sum >= q4) return 4;
  if (sum >= q3) return 3;
  if (sum >= q2) return 2;
  return 1;
}

/**
 * Compress a multi-year daily contribution series into a per-year, per-week
 * level matrix for a lifetime heatmap.
 *
 * Days are bucketed into (year, weekIndex), the `count` values are summed per
 * bucket, and each bucket's sum is leveled 0..4 by global quartile thresholds
 * derived from all non-zero weekly sums. Input order does not affect the result:
 * years are emitted ascending, and within a year `weeks` covers indices
 * 0..maxWeekIndexPresent with gaps filled at level 0.
 */
export function computeLifetime(days: readonly DayContribution[]): LifetimeData {
  const byYear = new Map<number, Map<number, number>>();
  for (const { date, count } of days) {
    const { year, weekIndex } = bucketOf(date);
    let weeks = byYear.get(year);
    if (weeks === undefined) {
      weeks = new Map<number, number>();
      byYear.set(year, weeks);
    }
    weeks.set(weekIndex, (weeks.get(weekIndex) ?? 0) + count);
  }

  const nonZeroSums: number[] = [];
  for (const weeks of byYear.values()) {
    for (const sum of weeks.values()) {
      if (sum > 0) nonZeroSums.push(sum);
    }
  }
  nonZeroSums.sort((a, b) => a - b);
  const thresholds = computeThresholds(nonZeroSums);

  const years: LifetimeYear[] = [...byYear.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([year, weeks]) => {
      let maxIndex = -1;
      for (const index of weeks.keys()) {
        if (index > maxIndex) maxIndex = index;
      }
      const cells: (0 | 1 | 2 | 3 | 4)[] = [];
      for (let index = 0; index <= maxIndex; index += 1) {
        cells.push(levelOf(weeks.get(index) ?? 0, thresholds));
      }
      return { year, weeks: cells };
    });

  return { years, thresholds };
}
