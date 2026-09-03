/** Language share computation for the Languages card. */

import type { LanguageSlice } from '../model.js';

export interface LanguageShare {
  readonly name: string;
  readonly color: string | null;
  readonly bytes: number;
  /** Percentage with one decimal; all shares sum to exactly 100.0. */
  readonly pct: number;
}

/**
 * Keep the top `limit` languages and fold the tail into "Other"
 * (categorical palettes must not run past ~8 hues). Percentages use
 * largest-remainder rounding so the printed values total 100.0.
 *
 * The result is sorted by size, "Other" included: the card reads as a ranked
 * list and as a treemap, and both break if one entry sits out of order — a
 * folded tail is regularly larger than the smallest language it outranks.
 */
export function languageShares(slices: readonly LanguageSlice[], limit = 8): LanguageShare[] {
  const total = slices.reduce((sum, slice) => sum + slice.bytes, 0);
  if (total === 0) return [];

  const kept = slices.slice(0, limit);
  const otherBytes = slices.slice(limit).reduce((sum, slice) => sum + slice.bytes, 0);
  const entries: LanguageSlice[] = (
    otherBytes > 0 ? [...kept, { name: 'Other', color: null, bytes: otherBytes }] : [...kept]
  ).toSorted((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));

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
