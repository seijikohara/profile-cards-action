/** Weekday × hour commit cadence over the trailing-year commit sweep. */

import type { CommitSample } from '../model.js';

export interface CadencePeak {
  /** 0 = Monday .. 6 = Sunday. */
  readonly weekday: number;
  /** 0..23. */
  readonly hour: number;
  readonly count: number;
}

export interface CadenceData {
  /** Commit counts, rows Monday..Sunday, columns hour 0..23. */
  readonly grid: readonly (readonly number[])[];
  /** Quantile level 0..4 per cell, same shape as grid. */
  readonly levels: readonly (readonly (0 | 1 | 2 | 3 | 4)[])[];
  /** The busiest cell; ties resolve to the earliest row-major position. Undefined without commits. */
  readonly peak: CadencePeak | undefined;
  readonly totalCommits: number;
  readonly additions: number;
  readonly deletions: number;
}

/**
 * Author-local clock face: the fields before the offset suffix. GitTimestamp
 * keeps the author's own offset, so the local hour reads straight off the
 * string — parsing through `Date` would re-normalize to UTC and shift every
 * bucket by the author's offset.
 */
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Return the weekday index for a local calendar date with Monday = 0 ..
 * Sunday = 6. `Date.UTC` with explicit integer args is deterministic and
 * clock-free; `getUTCDay` numbers Sunday = 0, so shift by 6 (mod 7) to move
 * Monday to the front, matching the rhythm and lifetime row order.
 */
function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/**
 * The four leveling lower bounds from the distribution of NON-ZERO cell
 * counts, mirroring the lifetime heatmap's scheme: minimum, then the 25th,
 * 50th, and 75th percentile cuts (nearest-rank on a 0-based index).
 */
function computeThresholds(sorted: readonly number[]): [number, number, number, number] {
  const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  if (sorted.length === 0) return [0, 0, 0, 0];
  return [sorted[0] ?? 0, at(0.25), at(0.5), at(0.75)];
}

/**
 * Level a cell count: the number of thresholds `t` with `t <= count`, 0 for
 * empty cells. The thresholds are non-decreasing, so the cascade implements
 * that count directly; a positive count below q1 cannot occur (q1 is the
 * minimum non-zero count) but falls back to the level-1 floor.
 */
function levelOf(count: number, thresholds: readonly [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const [q1, q2, q3, q4] = thresholds;
  if (q4 <= count) return 4;
  if (q3 <= count) return 3;
  if (q2 <= count) return 2;
  if (q1 <= count) return 1;
  return 1;
}

/** Aggregate the commit sweep into the weekday × hour punch-card grid. */
export function computeCadence(commits: readonly CommitSample[]): CadenceData {
  const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let additions = 0;
  let deletions = 0;

  for (const sample of commits) {
    const match = LOCAL_DATETIME.exec(sample.date);
    if (match === null) throw new Error(`invalid commit date: ${sample.date}`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23) {
      throw new Error(`invalid commit date: ${sample.date}`);
    }
    const row = grid[weekdayIndex(year, month, day)];
    if (row !== undefined) row[hour] = (row[hour] ?? 0) + 1;
    additions += sample.additions;
    deletions += sample.deletions;
  }

  const nonZero = grid
    .flat()
    .filter((count) => count > 0)
    .toSorted((a, b) => a - b);
  const thresholds = computeThresholds(nonZero);
  const levels = grid.map((row) => row.map((count) => levelOf(count, thresholds)));

  let peak: CadencePeak | undefined;
  grid.forEach((row, weekday) => {
    row.forEach((count, hour) => {
      if (count > 0 && count > (peak?.count ?? 0)) peak = { weekday, hour, count };
    });
  });

  return {
    grid,
    levels,
    peak,
    totalCommits: commits.length,
    additions,
    deletions,
  };
}
