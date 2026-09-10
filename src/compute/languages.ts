/** Language share computation for the Languages card. */

import { DEFAULT_LANGUAGE_LIMIT } from '../config.js';
import type { LanguageSlice } from '../model.js';

export interface LanguageShare {
  readonly name: string;
  readonly color: string | null;
  readonly bytes: number;
  /** Repositories the language appears in; 0 for the "Other" bucket. */
  readonly repos: number;
  /** Percentage with one decimal; all shares sum to exactly 100.0. */
  readonly pct: number;
}

/**
 * Keep the top `limit` languages and fold the rest into "Other". Percentages
 * use largest-remainder rounding so the printed values total 100.0.
 *
 * `unnamedBytes` is code the query counted but never named — languages past
 * the per-repository edge cap. It joins "Other" for the same reason the tail
 * does, and it belongs in the denominator either way: a percentage of the named
 * bytes alone would be a share of the wrong total.
 *
 * "Other" stays last however large it grows. It is a residual bucket, not a
 * language, so it does not compete for a rank — the convention every legend
 * and breakdown chart follows, and the one a reader arrives with.
 */
export function languageShares(
  slices: readonly LanguageSlice[],
  limit: number = DEFAULT_LANGUAGE_LIMIT,
  unnamedBytes = 0
): LanguageShare[] {
  const total = slices.reduce((sum, slice) => sum + slice.bytes, 0) + unnamedBytes;
  if (total === 0) return [];

  const kept = slices.slice(0, limit);
  const otherBytes = slices.slice(limit).reduce((sum, slice) => sum + slice.bytes, 0) + unnamedBytes;
  // "Other" spans an unknown set of repositories — summing per-language counts
  // would double-count any repository that holds two of them — so it reports
  // no reach rather than a wrong one.
  const entries: LanguageSlice[] =
    otherBytes > 0 ? [...kept, { name: 'Other', color: null, bytes: otherBytes, repos: 0 }] : [...kept];

  // Largest-remainder rounding in tenths of a percent: floor everything, then
  // bump the entries with the largest fractional parts until the tenths sum to
  // exactly 1000.
  const exact = entries.map((entry) => (entry.bytes / total) * 1000);
  const floors = exact.map((value) => Math.floor(value));
  const remainder = 1000 - floors.reduce((sum, value) => sum + value, 0);
  const bumped = new Set(
    exact
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .toSorted((a, b) => b.frac - a.frac || a.index - b.index)
      .slice(0, Math.max(0, remainder))
      .map((entry) => entry.index)
  );

  return entries.map((entry, index) => ({
    ...entry,
    pct: ((floors[index] ?? 0) + (bumped.has(index) ? 1 : 0)) / 10,
  }));
}
