import { describe, expect, it } from 'vitest';
import { languageShares } from '../src/compute/languages.js';
import type { LanguageSlice } from '../src/model.js';

function slice(name: string, bytes: number): LanguageSlice {
  return { name, color: '#123456', bytes };
}

describe('languageShares', () => {
  it('returns empty for no data', () => {
    expect(languageShares([])).toEqual([]);
    expect(languageShares([slice('A', 0)])).toEqual([]);
  });

  it('keeps at most `limit` languages and folds the tail into Other', () => {
    const slices = Array.from({ length: 11 }, (_, index) => slice(`L${index}`, 1000 - index));
    const shares = languageShares(slices, 8);
    expect(shares).toHaveLength(9);
    expect(shares.at(-1)?.name).toBe('Other');
    expect(shares.at(-1)?.color).toBeNull();
    expect(shares.at(-1)?.bytes).toBe(992 + 991 + 990);
  });

  it('keeps Other last even when the folded tail outweighs every language kept', () => {
    // 3 x ~990 bytes folded against a top language of 1000: Other outranks the
    // whole list by size and still belongs at the end, because it is the
    // remainder rather than an entry competing for a rank.
    const slices = Array.from({ length: 11 }, (_, index) => slice(`L${index}`, 1000 - index));
    const shares = languageShares(slices, 8);
    const other = shares.at(-1);
    expect(other?.name).toBe('Other');
    expect(other?.bytes).toBeGreaterThan(shares[0]?.bytes ?? 0);
  });

  it('ranks the kept languages by size ahead of Other', () => {
    const slices = Array.from({ length: 11 }, (_, index) => slice(`L${index}`, 1000 - index));
    const kept = languageShares(slices, 8)
      .slice(0, -1)
      .map((share) => share.bytes);
    expect(kept).toEqual(kept.toSorted((a, b) => b - a));
  });

  it('omits Other when everything fits', () => {
    const shares = languageShares([slice('A', 60), slice('B', 40)], 8);
    expect(shares.map((share) => share.name)).toEqual(['A', 'B']);
  });

  it('rounds percentages to one decimal summing exactly 100.0', () => {
    const shares = languageShares([slice('A', 1), slice('B', 1), slice('C', 1)], 8);
    const total = shares.reduce((sum, share) => sum + share.pct, 0);
    expect(Math.round(total * 10)).toBe(1000);
    for (const share of shares) {
      expect(share.pct).toBeCloseTo(33.3, 0);
    }
  });

  it('matches known real-world proportions', () => {
    const shares = languageShares(
      [slice('TypeScript', 7_036_949), slice('Kotlin', 2_760_299), slice('Java', 2_051_464)],
      8
    );
    expect(shares[0]?.pct).toBeCloseTo(59.4, 1);
    const total = shares.reduce((sum, share) => sum + share.pct, 0);
    expect(Math.round(total * 10)).toBe(1000);
  });
});
