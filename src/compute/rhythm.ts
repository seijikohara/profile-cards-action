/** Weekday and month rhythm aggregation over the daily contribution series. */

import type { DayContribution } from '../model.js';

export interface RhythmData {
  /** Every contribution in the series — the population the panels split. */
  readonly total: number;
  /** Summed counts per weekday, index 0 = Monday .. 6 = Sunday. */
  readonly weekday: readonly number[]; // length 7
  /** Summed counts per month, index 0 = January .. 11 = December. */
  readonly month: readonly number[]; // length 12
  /** Index (0..6) of the weekday with the greatest sum; 0 if all zero. */
  readonly peakWeekday: number;
  /** Index (0..11) of the month with the greatest sum; 0 if all zero. */
  readonly peakMonth: number;
  /** Days with any contribution over all days, in [0,1]; 0 for an empty series. */
  readonly activeDayRate: number;
  /** The day with the greatest count, first occurrence winning ties; undefined when all zero. */
  readonly busiestDay: { readonly date: string; readonly count: number } | undefined;
  /** Saturday + Sunday contributions over all contributions, in [0,1]; 0 when the total is 0. */
  readonly weekendShare: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Return the weekday index for an ISO date with Monday = 0 .. Sunday = 6.
 *
 * `Date.UTC` with explicit integer args is deterministic and clock-free.
 * `getUTCDay` numbers Sunday = 0 .. Saturday = 6, so shift by 6 (mod 7) to move
 * Monday to the front, matching the calendar heatmap's row order.
 */
function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Return the index of the greatest value; the lowest index wins ties, so 0 when all equal. */
function indexOfMax(values: readonly number[]): number {
  return values.reduce((best, value, index) => (value > (values[best] ?? 0) ? index : best), 0);
}

/** Aggregate a daily contribution series into weekday and month rhythms. */
export function computeRhythm(days: readonly DayContribution[]): RhythmData {
  const weekday: number[] = Array.from({ length: 7 }, () => 0);
  const month: number[] = Array.from({ length: 12 }, () => 0);

  for (const day of days) {
    const match = ISO_DATE.exec(day.date);
    if (match === null) throw new Error(`invalid calendar date: ${day.date}`);
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const dayOfMonth = Number(match[3]);

    // Month bucket derives from the parsed integer, not the Date object, so an
    // out-of-range day cannot roll the count into a neighbouring month.
    const monthIndex = monthNumber - 1;
    const weekdayBucket = weekdayIndex(year, monthNumber, dayOfMonth);
    weekday[weekdayBucket] = (weekday[weekdayBucket] ?? 0) + day.count;
    month[monthIndex] = (month[monthIndex] ?? 0) + day.count;
  }

  const activeDays = days.filter((day) => day.count > 0).length;
  const busiestDay = days.reduce<RhythmData['busiestDay']>(
    (best, day) => (day.count > (best?.count ?? 0) ? { date: day.date, count: day.count } : best),
    undefined
  );

  const total = weekday.reduce((sum, value) => sum + value, 0);
  const weekendSum = (weekday[5] ?? 0) + (weekday[6] ?? 0);

  return {
    total,
    weekday,
    month,
    peakWeekday: indexOfMax(weekday),
    peakMonth: indexOfMax(month),
    activeDayRate: days.length === 0 ? 0 : activeDays / days.length,
    busiestDay,
    weekendShare: total === 0 ? 0 : weekendSum / total,
  };
}
