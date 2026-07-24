import { describe, expect, it } from 'vitest';
import { computeComposition } from '../src/compute/composition.js';
import type { YearActivity } from '../src/model.js';

/** Build a YearActivity from partial segment counts; total defaults to the segment sum. */
function year(yearNumber: number, parts: Partial<Omit<YearActivity, 'year'>> = {}): YearActivity {
  const commits = parts.commits ?? 0;
  const pullRequests = parts.pullRequests ?? 0;
  const issues = parts.issues ?? 0;
  const reviews = parts.reviews ?? 0;
  const restricted = parts.restricted ?? 0;
  return {
    year: yearNumber,
    total: parts.total ?? commits + pullRequests + issues + reviews + restricted,
    commits,
    pullRequests,
    issues,
    reviews,
    restricted,
  };
}

describe('computeComposition', () => {
  it('extracts segments in [commits, pullRequests, issues, reviews, restricted] order', () => {
    const data = computeComposition([
      year(2023, { commits: 1, pullRequests: 2, issues: 3, reviews: 4, restricted: 5 }),
    ]);
    expect(data.years[0]?.segments).toEqual([1, 2, 3, 4, 5]);
  });

  it('sums the five segments and ignores year.total', () => {
    const data = computeComposition([
      // total is deliberately inconsistent (calendar-vs-event counting).
      year(2023, { commits: 1, pullRequests: 2, issues: 3, reviews: 4, restricted: 5, total: 999 }),
    ]);
    expect(data.years[0]?.sum).toBe(15);
  });

  it('preserves the input order of years without sorting', () => {
    const data = computeComposition([year(2024), year(2022), year(2023)]);
    expect(data.years.map((entry) => entry.year)).toEqual([2024, 2022, 2023]);
  });

  it('reports maxSum as the greatest per-year segment sum', () => {
    const data = computeComposition([
      year(2022, { commits: 3 }), // sum 3
      year(2023, { commits: 10, reviews: 7 }), // sum 17
      year(2024, { issues: 5 }), // sum 5
    ]);
    expect(data.maxSum).toBe(17);
  });

  it('computes privateShare as sum(restricted) / sum(sum), within [0,1]', () => {
    const data = computeComposition([
      year(2022, { commits: 10 }), // sum 10, restricted 0
      year(2023, { restricted: 10 }), // sum 10, restricted == sum
    ]);
    expect(data.privateShare).toBe(0.5);
    expect(data.privateShare).toBeGreaterThanOrEqual(0);
    expect(data.privateShare).toBeLessThanOrEqual(1);
  });

  it('reaches privateShare 1 when every contribution is restricted', () => {
    const data = computeComposition([year(2023, { restricted: 7 })]);
    expect(data.privateShare).toBe(1);
  });

  it('returns zero aggregates for all-zero input without dividing by zero', () => {
    const data = computeComposition([year(2022), year(2023)]);
    expect(data.maxSum).toBe(0);
    expect(data.privateShare).toBe(0);
    expect(Number.isNaN(data.privateShare)).toBe(false);
  });

  it('returns empty aggregates for no years', () => {
    expect(computeComposition([])).toEqual({ years: [], maxSum: 0, privateShare: 0 });
  });

  it('produces the full composition structure deterministically', () => {
    const input = [year(2022, { commits: 10 }), year(2023, { restricted: 10 })];
    const expected = {
      years: [
        { year: 2022, segments: [10, 0, 0, 0, 0], sum: 10 },
        { year: 2023, segments: [0, 0, 0, 0, 10], sum: 10 },
      ],
      maxSum: 10,
      privateShare: 0.5,
    };
    expect(computeComposition(input)).toEqual(expected);
    // Identical input yields identical output.
    expect(computeComposition(input)).toEqual(computeComposition(input));
  });
});
