/** Contribution composition aggregation for the stacked activity bars. */

import type { YearActivity } from '../model.js';

export interface YearComposition {
  readonly year: number;
  /** [commits, pullRequests, issues, reviews, restricted] */
  readonly segments: readonly [number, number, number, number, number];
  /** Sum of the five segments. */
  readonly sum: number;
}

export interface CompositionData {
  readonly years: readonly YearComposition[]; // same order as input
  /** Greatest `sum` across years (the bar scale); 0 if no years. */
  readonly maxSum: number;
  /** Σrestricted / Σsum across all years, in [0,1]; 0 when Σsum is 0. */
  readonly privateShare: number;
}

/**
 * Reduce each year to its five non-overlapping contribution segments.
 *
 * `sum` uses the five segments, not `year.total`: the calendar total counts
 * active days while the typed counts count events, so the two diverge slightly.
 * The bar scale (`maxSum`) and `privateShare` must agree with the drawn
 * segments, so both derive from the segment sum rather than `total`.
 */
export function computeComposition(years: readonly YearActivity[]): CompositionData {
  const composed = years.map((activity): YearComposition => {
    const segments = [
      activity.commits,
      activity.pullRequests,
      activity.issues,
      activity.reviews,
      activity.restricted,
    ] as const;
    return {
      year: activity.year,
      segments,
      sum: segments.reduce((total, value) => total + value, 0),
    };
  });

  const maxSum = composed.reduce((max, entry) => Math.max(max, entry.sum), 0);
  const totalSum = composed.reduce((total, entry) => total + entry.sum, 0);
  const totalRestricted = years.reduce((total, activity) => total + activity.restricted, 0);
  const privateShare = totalSum === 0 ? 0 : totalRestricted / totalSum;

  return { years: composed, maxSum, privateShare };
}
