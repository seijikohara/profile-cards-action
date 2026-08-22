import { describe, expect, it } from 'vitest';
import { computeCadence } from '../src/compute/cadence.js';
import type { CommitSample } from '../src/model.js';

function commit(date: string, additions = 0, deletions = 0): CommitSample {
  return { date, additions, deletions };
}

describe('computeCadence', () => {
  it('buckets a +09:00 commit by its local clock face, not UTC', () => {
    // 2026-08-17 is a Monday; local hour 8. The UTC instant is Sunday 23:14,
    // so a UTC-normalizing implementation would land in [6][23] instead.
    const result = computeCadence([commit('2026-08-17T08:14:07+09:00')]);
    expect(result.grid[0]?.[8]).toBe(1);
    expect(result.grid[6]?.[23]).toBe(0);
    expect(result.totalCommits).toBe(1);
  });

  it('buckets a Z (UTC) commit by its UTC clock face', () => {
    // 2026-08-16 is a Sunday; hour 17.
    const result = computeCadence([commit('2026-08-16T17:37:13Z')]);
    expect(result.grid[6]?.[17]).toBe(1);
  });

  it('buckets a negative-offset commit by its local clock face', () => {
    // 2026-01-02 is a Friday; local hour 23.
    const result = computeCadence([commit('2026-01-02T23:10:00-05:00')]);
    expect(result.grid[4]?.[23]).toBe(1);
  });

  it('accepts fractional seconds', () => {
    const result = computeCadence([commit('2026-08-17T08:14:07.123+09:00')]);
    expect(result.grid[0]?.[8]).toBe(1);
  });

  it('produces a 7x24 grid and matching levels shape', () => {
    const result = computeCadence([]);
    expect(result.grid).toHaveLength(7);
    expect(result.levels).toHaveLength(7);
    for (let row = 0; row < 7; row += 1) {
      expect(result.grid[row]).toHaveLength(24);
      expect(result.levels[row]).toHaveLength(24);
    }
  });

  it('sums totals across commits', () => {
    const result = computeCadence([
      commit('2026-08-17T08:00:00+09:00', 10, 3),
      commit('2026-08-17T08:30:00+09:00', 5, 2),
      commit('2026-08-18T09:00:00+09:00', 1, 1),
    ]);
    expect(result.totalCommits).toBe(3);
    expect(result.additions).toBe(16);
    expect(result.deletions).toBe(6);
  });

  it('finds the peak cell and resolves ties to the earliest scan position', () => {
    const result = computeCadence([
      commit('2026-08-17T08:00:00+09:00'),
      commit('2026-08-17T08:15:00+09:00'),
      commit('2026-08-18T10:00:00+09:00'),
    ]);
    expect(result.peak).toEqual({ weekday: 0, hour: 8, count: 2 });
  });

  it('returns undefined peak and all-zero levels for empty input', () => {
    const result = computeCadence([]);
    expect(result.peak).toBeUndefined();
    expect(result.totalCommits).toBe(0);
    expect(result.levels.every((row) => row.every((level) => level === 0))).toBe(true);
  });

  it('levels cells over the non-zero distribution like the lifetime heatmap', () => {
    // Two distinct cells: counts 1 and 3. Sorted non-zero sums S = [1, 3] give
    // thresholds q1=1, q2=1, q3=3, q4=3, so count 1 -> level 2, count 3 -> level 4.
    const result = computeCadence([
      commit('2026-08-17T08:00:00+09:00'),
      commit('2026-08-18T09:00:00+09:00'),
      commit('2026-08-18T09:10:00+09:00'),
      commit('2026-08-18T09:20:00+09:00'),
    ]);
    expect(result.levels[0]?.[8]).toBe(2);
    expect(result.levels[1]?.[9]).toBe(4);
    expect(result.levels[2]?.[8]).toBe(0);
  });

  it('conserves the commit count across the grid', () => {
    const commits = [
      commit('2026-08-17T00:00:00+09:00'),
      commit('2026-08-19T12:59:59-05:00'),
      commit('2026-08-22T23:00:00Z'),
    ];
    const total = computeCadence(commits)
      .grid.flat()
      .reduce((sum, count) => sum + count, 0);
    expect(total).toBe(commits.length);
  });

  it('throws on malformed dates', () => {
    expect(() => computeCadence([commit('2026-08-17 08:00:00')])).toThrow('invalid commit date');
    expect(() => computeCadence([commit('2026-08-17T25:00:00Z')])).toThrow('invalid commit date');
    expect(() => computeCadence([commit('2026-13-01T08:00:00Z')])).toThrow('invalid commit date');
  });
});
