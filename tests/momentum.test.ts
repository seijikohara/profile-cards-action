import { describe, expect, it } from 'vitest';
import { computeMomentum } from '../src/compute/momentum.js';
import { range } from '../src/iter.js';
import type { DayContribution, YearActivity } from '../src/model.js';

const DAY_MS = 86_400_000;

/** `days` consecutive days from `start`, each carrying `count`. */
function series(start: string, days: number, count: (index: number) => number): DayContribution[] {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  return range(days).map((index) => ({
    date: new Date(startMs + index * DAY_MS).toISOString().slice(0, 10),
    count: count(index),
    level: 0,
  }));
}

describe('computeMomentum', () => {
  it('draws nothing before a full window has elapsed', () => {
    const result = computeMomentum(series('2025-01-01', 300, () => 1));
    expect(result.points).toEqual([]);
    expect(result.peak).toBeUndefined();
    expect(result.current).toBeUndefined();
  });

  it('sums exactly the 365 days ending at each sample', () => {
    const result = computeMomentum(series('2024-01-01', 400, () => 2));
    expect(result.current?.total).toBe(730);
    expect(result.points.every((point) => point.total === 730)).toBe(true);
  });

  it('ends the series on the newest day, whatever the sample stride', () => {
    const days = series('2024-01-01', 400, () => 1);
    const result = computeMomentum(days);
    expect(result.current?.date).toBe(days.at(-1)?.date);
  });

  it('falls when activity stops, unlike a cumulative total', () => {
    // A busy first year, then a silent one: the rolling total must decay to 0.
    const result = computeMomentum(series('2024-01-01', 730, (index) => (index < 365 ? 3 : 0)));
    expect(result.peak?.total).toBeGreaterThan(0);
    expect(result.current?.total).toBe(0);
  });

  it('counts the whole history, not just the drawn window', () => {
    const result = computeMomentum(series('2024-01-01', 400, () => 2));
    expect(result.lifetimeTotal).toBe(800);
  });

  it('dates the history from the first day that carried work', () => {
    const result = computeMomentum(series('2024-01-01', 400, (index) => (index < 10 ? 0 : 1)));
    expect(result.since).toBe('2024-01-11');
  });

  it('ignores partial years when picking the quietest one', () => {
    // The series starts mid-2023 and ends mid-2026, so only 2024 and 2025 are
    // fully covered; 2023 is the smallest number but the shortest window.
    const days = series('2023-07-01', 1100, () => 1);
    const years: YearActivity[] = [2023, 2024, 2025, 2026].map((year) => ({
      year,
      total: year === 2023 ? 1 : year === 2025 ? 10 : 100,
      commits: 0,
      pullRequests: 0,
      issues: 0,
      reviews: 0,
      restricted: 0,
    }));
    expect(computeMomentum(days, years).quietestYear).toEqual({ year: 2025, total: 10 });
  });

  it('has no quietest year before one has completed', () => {
    expect(
      computeMomentum(
        series('2024-06-01', 400, () => 1),
        []
      ).quietestYear
    ).toBeUndefined();
  });

  it('handles an empty history', () => {
    const result = computeMomentum([]);
    expect(result).toMatchObject({ points: [], lifetimeTotal: 0, since: undefined });
  });
});
