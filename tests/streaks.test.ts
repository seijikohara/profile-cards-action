import { describe, expect, it } from 'vitest';
import { computeStreaks } from '../src/compute/streaks.js';
import type { DayContribution } from '../src/model.js';

function day(date: string, count: number): DayContribution {
  return { date, count, level: count === 0 ? 0 : 1 };
}

describe('computeStreaks', () => {
  it('returns zeros for an empty series', () => {
    expect(computeStreaks([])).toMatchObject({ current: 0, longest: 0 });
  });

  it('counts a single active day', () => {
    expect(computeStreaks([day('2026-07-22', 3)])).toMatchObject({ current: 1, longest: 1 });
  });

  it('breaks runs on zero days', () => {
    const days = [
      day('2026-07-18', 1),
      day('2026-07-19', 2),
      day('2026-07-20', 0),
      day('2026-07-21', 1),
      day('2026-07-22', 1),
    ];
    expect(computeStreaks(days)).toMatchObject({ current: 2, longest: 2 });
  });

  it('keeps the current streak alive when the last day is still zero', () => {
    const days = [day('2026-07-20', 4), day('2026-07-21', 2), day('2026-07-22', 0)];
    expect(computeStreaks(days)).toMatchObject({ current: 2, longest: 2 });
  });

  it('ends the current streak when the last two days are zero', () => {
    const days = [day('2026-07-20', 4), day('2026-07-21', 0), day('2026-07-22', 0)];
    expect(computeStreaks(days)).toMatchObject({ current: 0, longest: 1 });
  });

  it('spans year boundaries', () => {
    const days = [day('2025-12-30', 1), day('2025-12-31', 1), day('2026-01-01', 1), day('2026-01-02', 1)];
    expect(computeStreaks(days)).toMatchObject({ current: 4, longest: 4 });
  });

  it('treats missing dates as gaps even without explicit zero days', () => {
    const days = [day('2026-07-10', 5), day('2026-07-12', 5), day('2026-07-13', 5)];
    expect(computeStreaks(days)).toMatchObject({ current: 2, longest: 2 });
  });

  it('tracks a longest streak that is not the current one', () => {
    const days = [
      day('2026-07-10', 1),
      day('2026-07-11', 1),
      day('2026-07-12', 1),
      day('2026-07-13', 0),
      day('2026-07-14', 9),
    ];
    expect(computeStreaks(days)).toMatchObject({ current: 1, longest: 3 });
  });

  it('handles leap-day continuity', () => {
    const days = [day('2024-02-28', 1), day('2024-02-29', 1), day('2024-03-01', 1)];
    expect(computeStreaks(days)).toMatchObject({ current: 3, longest: 3 });
  });

  it('rejects malformed dates', () => {
    expect(() => computeStreaks([day('garbage', 1)])).toThrow(/invalid calendar date/);
  });

  it('reports date ranges for both streaks', () => {
    const days = [
      day('2026-07-10', 1),
      day('2026-07-11', 1),
      day('2026-07-12', 1),
      day('2026-07-13', 0),
      day('2026-07-14', 9),
    ];
    expect(computeStreaks(days)).toEqual({
      current: 1,
      longest: 3,
      currentRange: { start: '2026-07-14', end: '2026-07-14' },
      longestRange: { start: '2026-07-10', end: '2026-07-12' },
    });
  });

  it('omits ranges when there are no contributions', () => {
    const result = computeStreaks([day('2026-07-21', 0), day('2026-07-22', 0)]);
    expect(result.currentRange).toBeUndefined();
    expect(result.longestRange).toBeUndefined();
  });

  it('does not bridge a gap through the forgiven trailing zero day', () => {
    const days = [day('2026-07-10', 5), day('2026-07-22', 0)];
    expect(computeStreaks(days)).toMatchObject({ current: 0, longest: 1 });
    expect(computeStreaks(days).currentRange).toBeUndefined();
  });

  it('forgives the trailing zero day in the current range', () => {
    const days = [day('2026-07-20', 4), day('2026-07-21', 2), day('2026-07-22', 0)];
    expect(computeStreaks(days).currentRange).toEqual({
      start: '2026-07-20',
      end: '2026-07-21',
    });
  });
});
