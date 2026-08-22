import { describe, expect, it } from 'vitest';
import { computeRhythm } from '../src/compute/rhythm.js';
import type { DayContribution } from '../src/model.js';

function day(date: string, count: number): DayContribution {
  return { date, count, level: count === 0 ? 0 : 1 };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('computeRhythm', () => {
  it('maps a full week to Monday=0..Sunday=6 buckets', () => {
    // 2026-07-20 is a Monday .. 2026-07-26 a Sunday; counts 1..7 tag each day so
    // every weekday bucket is individually verifiable.
    const days = [
      day('2026-07-20', 1), // Monday
      day('2026-07-21', 2), // Tuesday
      day('2026-07-22', 3), // Wednesday
      day('2026-07-23', 4), // Thursday
      day('2026-07-24', 5), // Friday
      day('2026-07-25', 6), // Saturday
      day('2026-07-26', 7), // Sunday
    ];
    expect(computeRhythm(days).weekday).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('places 2026-07-22 (Wednesday) in weekday index 2', () => {
    const result = computeRhythm([day('2026-07-22', 5)]);
    expect(result.weekday).toEqual([0, 0, 5, 0, 0, 0, 0]);
  });

  it('produces fixed-length weekday(7) and month(12) arrays', () => {
    const result = computeRhythm([day('2026-07-22', 5)]);
    expect(result.weekday).toHaveLength(7);
    expect(result.month).toHaveLength(12);
  });

  it('conserves total counts: sum(weekday) == sum(month) == sum(counts)', () => {
    const days = [
      day('2020-01-01', 3),
      day('2020-03-15', 7),
      day('2021-07-22', 2),
      day('2022-12-31', 11),
      day('2024-02-29', 5), // leap day
      day('2026-07-22', 0),
    ];
    const total = sum(days.map((entry) => entry.count));
    const result = computeRhythm(days);
    expect(sum(result.weekday)).toBe(total);
    expect(sum(result.month)).toBe(total);
    expect(sum(result.weekday)).toBe(sum(result.month));
  });

  it('routes a March day to month index 2', () => {
    const result = computeRhythm([day('2020-03-15', 9)]);
    expect(result.month).toEqual([0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('buckets months by their calendar position', () => {
    const days = [
      day('2026-01-10', 1), // January -> 0
      day('2026-06-10', 2), // June -> 5
      day('2026-12-10', 3), // December -> 11
    ];
    const result = computeRhythm(days);
    expect(result.month[0]).toBe(1);
    expect(result.month[5]).toBe(2);
    expect(result.month[11]).toBe(3);
  });

  it('identifies the peak weekday and peak month', () => {
    const days = [
      day('2026-07-20', 1), // Monday, July
      day('2026-07-21', 2), // Tuesday, July
      day('2026-07-22', 8), // Wednesday, July -> weekday peak
      day('2026-03-05', 4), // Thursday, March
    ];
    const result = computeRhythm(days);
    expect(result.peakWeekday).toBe(2); // Wednesday holds the largest sum
    expect(result.peakMonth).toBe(6); // July (11) beats March (4)
  });

  it('returns all zeros and peak 0 for empty input without throwing', () => {
    const result = computeRhythm([]);
    expect(result.weekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.month).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.peakWeekday).toBe(0);
    expect(result.peakMonth).toBe(0);
  });

  it('is deterministic: identical input yields identical output', () => {
    const days = [day('2026-07-22', 3), day('2020-03-15', 9), day('2022-12-31', 4)];
    expect(computeRhythm(days)).toEqual(computeRhythm(days));
  });

  it('rejects malformed dates', () => {
    expect(() => computeRhythm([day('garbage', 1)])).toThrow(/invalid calendar date/);
  });

  it('computes the active-day rate over the whole series', () => {
    const days = [day('2026-07-20', 1), day('2026-07-21', 0), day('2026-07-22', 3), day('2026-07-23', 0)];
    expect(computeRhythm(days).activeDayRate).toBe(0.5);
  });

  it('finds the busiest day, first occurrence winning ties', () => {
    const days = [day('2026-07-20', 2), day('2026-07-21', 9), day('2026-07-22', 9)];
    expect(computeRhythm(days).busiestDay).toEqual({ date: '2026-07-21', count: 9 });
  });

  it('computes the weekend share of contributions', () => {
    // Sat 6 + Sun 7 = 13 of total 26.
    const days = [
      day('2026-07-20', 5),
      day('2026-07-22', 8),
      day('2026-07-25', 6), // Saturday
      day('2026-07-26', 7), // Sunday
    ];
    expect(computeRhythm(days).weekendShare).toBe(0.5);
  });

  it('reports zero rates and no busiest day for an all-zero series', () => {
    const result = computeRhythm([day('2026-07-20', 0), day('2026-07-21', 0)]);
    expect(result.activeDayRate).toBe(0);
    expect(result.weekendShare).toBe(0);
    expect(result.busiestDay).toBeUndefined();
  });

  it('reports zero rates for an empty series', () => {
    const result = computeRhythm([]);
    expect(result.activeDayRate).toBe(0);
    expect(result.weekendShare).toBe(0);
    expect(result.busiestDay).toBeUndefined();
  });
});
