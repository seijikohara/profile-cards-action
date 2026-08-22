import { describe, expect, it } from 'vitest';
import { computeLifetime } from '../src/compute/lifetime.js';
import type { DayContribution } from '../src/model.js';

function day(date: string, count: number): DayContribution {
  return { date, count, level: count === 0 ? 0 : 1 };
}

// First calendar day of each 7-day bucket (weekIndex 0..11) in the common
// year 2021: ordinal 7*k+1. Used to drive one day per week bucket.
const WEEK_STARTS_2021 = [
  '2021-01-01', // week 0, ordinal 1
  '2021-01-08', // week 1, ordinal 8
  '2021-01-15', // week 2, ordinal 15
  '2021-01-22', // week 3, ordinal 22
  '2021-01-29', // week 4, ordinal 29
  '2021-02-05', // week 5, ordinal 36
  '2021-02-12', // week 6, ordinal 43
  '2021-02-19', // week 7, ordinal 50
  '2021-02-26', // week 8, ordinal 57
  '2021-03-05', // week 9, ordinal 64
  '2021-03-12', // week 10, ordinal 71
  '2021-03-19', // week 11, ordinal 78
] as const;

describe('computeLifetime', () => {
  it('returns no years and zero thresholds for empty input', () => {
    expect(computeLifetime([])).toEqual({ years: [], thresholds: [0, 0, 0, 0] });
  });

  it('emits one year per calendar year, ascending, regardless of input order', () => {
    const result = computeLifetime([
      day('2021-06-15', 3),
      day('2019-01-01', 1),
      day('2022-12-31', 5),
      day('2020-02-29', 2),
    ]);
    expect(result.years.map((entry) => entry.year)).toEqual([2019, 2020, 2021, 2022]);
  });

  it('collapses same-week days into one bucket and splits days a week apart', () => {
    // 2021-01-01 (ordinal 1) and 2021-01-07 (ordinal 7) share weekIndex 0.
    const sameWeek = computeLifetime([day('2021-01-01', 1), day('2021-01-07', 1)]);
    expect(sameWeek.years).toHaveLength(1);
    expect(sameWeek.years[0]?.weeks).toHaveLength(1); // only bucket 0 present

    // 2021-01-08 (ordinal 8) is 7 days later and lands in weekIndex 1.
    const acrossWeeks = computeLifetime([day('2021-01-01', 1), day('2021-01-08', 1)]);
    expect(acrossWeeks.years[0]?.weeks).toHaveLength(2); // buckets 0 and 1
  });

  it('sums counts within a week bucket', () => {
    // Two days in weekIndex 0 (ordinals 1 and 5) must equal a single day of the sum.
    const split = computeLifetime([day('2021-01-01', 5), day('2021-01-05', 5)]);
    const single = computeLifetime([day('2021-01-01', 10)]);
    expect(split).toEqual(single);
    expect(split.years[0]?.weeks).toEqual([4]); // lone bucket is the max -> level 4
  });

  it('levels weekly sums into 0..4 quartile bands with a zero-week gap', () => {
    const days = [
      day('2021-01-01', 1), // week 0, sum 1
      day('2021-01-08', 2), // week 1, sum 2
      day('2021-01-15', 3), // week 2, sum 3
      day('2021-01-22', 4), // week 3, sum 4
      // week 4 intentionally empty -> filled with level 0
      day('2021-02-05', 5), // week 5, sum 5
      day('2021-02-12', 6), // week 6, sum 6
      day('2021-02-19', 7), // week 7, sum 7
      day('2021-02-26', 8), // week 8, sum 8
    ];
    const result = computeLifetime(days);
    expect(result.thresholds).toEqual([1, 3, 5, 7]);
    expect(result.years).toHaveLength(1);
    const weeks = result.years[0]?.weeks;
    expect(weeks).toEqual([1, 1, 2, 2, 0, 3, 3, 4, 4]);
    expect(weeks?.[4]).toBe(0); // zero-count week is level 0
    expect(weeks?.at(-1)).toBe(4); // highest weekly sum is level 4
  });

  it('assigns non-decreasing levels as weekly sums increase', () => {
    // One day per week bucket 0..11 with strictly increasing sums 1..12.
    const days = WEEK_STARTS_2021.map((date, index) => day(date, index + 1));
    const result = computeLifetime(days);
    expect(result.thresholds).toEqual([1, 4, 7, 10]);
    const weeks = result.years[0]?.weeks ?? [];
    expect(weeks).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    // Monotonic in weekly sum: already ordered by increasing sum.
    expect([...weeks]).toEqual([...weeks].toSorted((a, b) => a - b));
    expect(weeks[0]).toBe(1); // smallest positive sum -> level 1
    expect(weeks.at(-1)).toBe(4); // largest sum -> level 4
  });

  it('accepts Feb 29 in a leap year and bucket it as ordinal 60', () => {
    const result = computeLifetime([day('2020-02-29', 5)]);
    expect(result.years[0]?.year).toBe(2020);
    // ordinal 60 -> weekIndex floor(59/7) = 8 -> length 9.
    expect(result.years[0]?.weeks).toHaveLength(9);
  });

  it('counts the leap day so dates after Feb 29 shift one bucket versus a common year', () => {
    // 2020 is a leap year: 2020-03-04 is ordinal 64 -> weekIndex 9.
    const leap = computeLifetime([day('2020-03-04', 1)]);
    // 2021 is common: 2021-03-04 is ordinal 63 -> weekIndex 8.
    const common = computeLifetime([day('2021-03-04', 1)]);
    expect(leap.years[0]?.weeks).toHaveLength(10); // indices 0..9
    expect(common.years[0]?.weeks).toHaveLength(9); // indices 0..8
    expect(leap.years[0]?.weeks.at(-1)).toBe(4); // lone active bucket -> level 4
    expect(common.years[0]?.weeks.at(-1)).toBe(4);
  });

  it('keeps December 31 within weekIndex 52 in both leap and common years', () => {
    // Guards the <= 53 cell bound even when the leap day pushes the ordinal to 366.
    const leap = computeLifetime([day('2020-12-31', 1)]);
    const common = computeLifetime([day('2021-12-31', 1)]);
    expect(leap.years[0]?.weeks).toHaveLength(53); // weekIndex 52 -> length 53
    expect(common.years[0]?.weeks).toHaveLength(53);
  });

  it('is deterministic and order-independent', () => {
    const series: DayContribution[] = [
      day('2019-05-06', 3),
      day('2019-05-13', 1),
      day('2020-02-29', 4),
      day('2020-03-04', 2),
      day('2021-01-01', 5),
      day('2021-01-08', 6),
      day('2022-12-26', 7),
    ];
    const shuffled: DayContribution[] = [
      day('2021-01-08', 6),
      day('2022-12-26', 7),
      day('2019-05-13', 1),
      day('2020-03-04', 2),
      day('2019-05-06', 3),
      day('2021-01-01', 5),
      day('2020-02-29', 4),
    ];
    const first = computeLifetime(series);
    expect(computeLifetime(series)).toEqual(first); // stable across calls
    expect(computeLifetime(shuffled)).toEqual(first); // independent of input order
  });

  it('carries per-year daily-count totals for the row column', () => {
    const result = computeLifetime([day('2020-01-01', 3), day('2020-01-02', 4), day('2021-06-15', 10)]);
    expect(result.years.map((entry) => ({ year: entry.year, total: entry.total }))).toEqual([
      { year: 2020, total: 7 },
      { year: 2021, total: 10 },
    ]);
  });

  it('totals zero for a year of empty days', () => {
    const result = computeLifetime([day('2020-01-01', 0)]);
    expect(result.years[0]?.total).toBe(0);
  });
});
