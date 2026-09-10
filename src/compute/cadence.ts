/** Weekday × hour commit cadence over the trailing-year commit sweep. */

import { range } from '../iter.js';
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
  /** Commits per hour of day summed over weekdays, index 0..23 — the marginal day curve. */
  readonly hourTotals: readonly number[];
  /** Quantile level 0..4 per cell, same shape as grid. */
  readonly levels: readonly (readonly (0 | 1 | 2 | 3 | 4)[])[];
  /** Lower bounds of levels 1..4, so the legend can name what a shade is worth. */
  readonly thresholds: readonly [number, number, number, number];
  /** The busiest cell; ties resolve to the earliest row-major position. Undefined without commits. */
  readonly peak: CadencePeak | undefined;
  readonly totalCommits: number;
  readonly additions: number;
  readonly deletions: number;
  /** Commits between 22:00 and 05:59 author-local over all commits, in [0,1]; 0 without commits. */
  readonly nightShare: number;
  /** Commit counts per size bucket, in SIZE_BUCKETS order. */
  readonly sizeBuckets: readonly number[];
  /** Median lines changed per file; undefined when no commit reported a file count. */
  readonly medianLinesPerFile: number | undefined;
  /** Median lines changed per commit; undefined without commits. */
  readonly medianLines: number | undefined;
}

/**
 * Log-spaced buckets of lines changed per commit.
 *
 * A raw churn total says nothing a reader can use — one regenerated bundle
 * swamps a year of hand edits. The shape of the distribution does: it separates
 * a habit of small commits from a habit of large ones.
 */
export const SIZE_BUCKETS: readonly { readonly label: string; readonly min: number }[] = [
  { label: '0', min: 0 },
  { label: '1–9', min: 1 },
  { label: '10–99', min: 10 },
  { label: '100–999', min: 100 },
  { label: '1k+', min: 1000 },
];

/** Index of the bucket a commit of `lines` belongs to. */
function sizeBucket(lines: number): number {
  return SIZE_BUCKETS.reduce((best, bucket, index) => (lines >= bucket.min ? index : best), 0);
}

/** Median of a non-empty numeric sample, averaging the middle pair when even. */
function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
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
  }

  const additions = commits.reduce((sum, sample) => sum + sample.additions, 0);
  const deletions = commits.reduce((sum, sample) => sum + sample.deletions, 0);

  const nonZero = grid
    .flat()
    .filter((count) => count > 0)
    .toSorted((a, b) => a - b);
  const thresholds = computeThresholds(nonZero);
  const levels = grid.map((row) => row.map((count) => levelOf(count, thresholds)));

  const peak = grid.reduce<CadencePeak | undefined>(
    (best, row, weekday) =>
      row.reduce<CadencePeak | undefined>(
        (rowBest, count, hour) => (count > (rowBest?.count ?? 0) ? { weekday, hour, count } : rowBest),
        best
      ),
    undefined
  );

  const sizeBuckets = commits.reduce<number[]>(
    (buckets, sample) => {
      const index = sizeBucket(sample.additions + sample.deletions);
      buckets[index] = (buckets[index] ?? 0) + 1;
      return buckets;
    },
    SIZE_BUCKETS.map(() => 0)
  );

  // Lines per file, not per commit: the ratio is what separates a hand edit
  // from a regenerated bundle, and it is unavailable for commits whose diff
  // GitHub has not computed.
  const perFile = commits.flatMap((sample) =>
    sample.changedFiles !== null && sample.changedFiles > 0
      ? [(sample.additions + sample.deletions) / sample.changedFiles]
      : []
  );

  const nightCommits = grid.reduce(
    (sum, row) => sum + row.reduce((rowSum, count, hour) => (hour >= 22 || hour < 6 ? rowSum + count : rowSum), 0),
    0
  );

  return {
    grid,
    hourTotals: range(24).map((hour) => grid.reduce((sum, row) => sum + (row[hour] ?? 0), 0)),
    levels,
    thresholds,
    peak,
    totalCommits: commits.length,
    additions,
    deletions,
    nightShare: commits.length === 0 ? 0 : nightCommits / commits.length,
    sizeBuckets,
    medianLinesPerFile: median(perFile),
    medianLines: median(commits.map((sample) => sample.additions + sample.deletions)),
  };
}
