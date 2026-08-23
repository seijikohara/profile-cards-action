import { describe, expect, it } from 'vitest';
import { squarify } from '../src/compute/treemap.js';
import type { TreemapRect } from '../src/compute/treemap.js';
import { range } from '../src/iter.js';

const EPS = 1e-6;

function rectArea(rect: TreemapRect): number {
  return rect.width * rect.height;
}

/** Assert every geometric invariant of a layout at once. */
function validateLayout(
  weights: readonly number[],
  bx: number,
  by: number,
  bw: number,
  bh: number
): readonly TreemapRect[] {
  const rects = squarify(weights, bx, by, bw, bh);
  const n = weights.length;

  // Exactly one rect per weight.
  expect(rects).toHaveLength(n);

  // Indices form a bijection with {0..n-1}, so callers can map back by index.
  const indices = rects.map((r) => r.index).toSorted((a, b) => a - b);
  expect(indices).toEqual([...Array(n).keys()]);

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const boundingArea = bw * bh;
  const totalArea = rects.reduce((sum, r) => sum + rectArea(r), 0);

  for (const r of rects) {
    // No negative dimensions.
    expect(r.width).toBeGreaterThanOrEqual(-EPS);
    expect(r.height).toBeGreaterThanOrEqual(-EPS);

    // Inside the bounding rect.
    expect(r.x).toBeGreaterThanOrEqual(bx - EPS);
    expect(r.y).toBeGreaterThanOrEqual(by - EPS);
    expect(r.x + r.width).toBeLessThanOrEqual(bx + bw + EPS);
    expect(r.y + r.height).toBeLessThanOrEqual(by + bh + EPS);

    // Area proportional to weight.
    const expectedFraction = weights[r.index]! / totalWeight;
    const actualFraction = rectArea(r) / totalArea;
    expect(Math.abs(actualFraction - expectedFraction)).toBeLessThanOrEqual(EPS);
  }

  // Coverage: rects tile the bounding area.
  expect(Math.abs(totalArea - boundingArea)).toBeLessThanOrEqual(boundingArea * EPS);

  // No pairwise overlaps.
  for (const i of range(rects.length)) {
    for (const j of range(rects.length - i - 1, i + 1)) {
      const a = rects[i]!;
      const b = rects[j]!;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(overlapX > EPS && overlapY > EPS).toBe(false);
    }
  }

  return rects;
}

const scenarios: {
  readonly name: string;
  readonly weights: number[];
  readonly rect: [number, number, number, number];
}[] = [
  { name: 'single weight', weights: [5], rect: [0, 0, 100, 100] },
  { name: 'two weights', weights: [3, 1], rect: [0, 0, 120, 80] },
  { name: 'equal weights', weights: [1, 1, 1, 1], rect: [0, 0, 200, 100] },
  { name: 'varied weights', weights: [6, 6, 4, 3, 2, 2, 1], rect: [0, 0, 300, 200] },
  { name: 'powers of two', weights: [64, 32, 16, 8, 4, 2, 1], rect: [0, 0, 400, 250] },
  {
    name: 'offset bounding rect',
    weights: [50, 30, 20, 10, 10, 5, 5, 5, 3, 2, 1],
    rect: [10, 20, 800, 600],
  },
  { name: 'tall narrow rect', weights: [7, 5, 3, 2, 1], rect: [4, 4, 60, 400] },
  { name: 'fractional weights', weights: [0.5, 1.25, 2.75, 0.1], rect: [0, 0, 137, 211] },
];

describe('squarify', () => {
  for (const scenario of scenarios) {
    it(`satisfies every invariant for ${scenario.name}`, () => {
      validateLayout(scenario.weights, ...scenario.rect);
    });
  }

  it('returns exactly one rect per weight with a full index bijection', () => {
    const rects = squarify([4, 2, 8, 1, 5], 0, 0, 300, 200);
    expect(rects).toHaveLength(5);
    expect(rects.map((r) => r.index).toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps every rect within the bounding rect with non-negative dimensions', () => {
    const bx = 10;
    const by = 20;
    const bw = 640;
    const bh = 360;
    const rects = squarify([9, 7, 5, 4, 3, 2, 1], bx, by, bw, bh);
    for (const r of rects) {
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeGreaterThanOrEqual(bx - EPS);
      expect(r.y).toBeGreaterThanOrEqual(by - EPS);
      expect(r.x + r.width).toBeLessThanOrEqual(bx + bw + EPS);
      expect(r.y + r.height).toBeLessThanOrEqual(by + bh + EPS);
    }
  });

  it('covers the bounding area (sum of rect areas equals bounding area)', () => {
    const rects = squarify([5, 3, 2, 8, 1, 6], 0, 0, 500, 300);
    const total = rects.reduce((sum, r) => sum + rectArea(r), 0);
    expect(Math.abs(total - 500 * 300)).toBeLessThanOrEqual(500 * 300 * EPS);
  });

  it("makes each rect's area proportional to its weight", () => {
    const weights = [10, 6, 6, 4, 2, 1];
    const rects = squarify(weights, 0, 0, 420, 260);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const totalArea = rects.reduce((sum, r) => sum + rectArea(r), 0);
    for (const r of rects) {
      const expectedFraction = weights[r.index]! / totalWeight;
      const actualFraction = rectArea(r) / totalArea;
      expect(Math.abs(actualFraction - expectedFraction)).toBeLessThanOrEqual(EPS);
    }
  });

  it('produces no pairwise overlaps', () => {
    const rects = squarify([8, 5, 5, 3, 3, 2, 2, 1], 0, 0, 360, 240);
    for (const i of range(rects.length)) {
      for (const j of range(rects.length - i - 1, i + 1)) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(overlapX > EPS && overlapY > EPS).toBe(false);
      }
    }
  });

  it('is deterministic: identical input yields identical output', () => {
    const weights = [7, 3, 9, 2, 5, 1, 4];
    const first = squarify(weights, 3, 7, 321, 199);
    const second = squarify(weights, 3, 7, 321, 199);
    expect(first).toEqual(second);
  });

  it('returns the full rect for a single weight', () => {
    expect(squarify([5], 3, 7, 20, 40)).toEqual([{ x: 3, y: 7, width: 20, height: 40, index: 0 }]);
  });

  it('does not mutate the input weights array', () => {
    const weights = [3, 1, 4, 1, 5];
    const snapshot = [...weights];
    squarify(weights, 0, 0, 100, 100);
    expect(weights).toEqual(snapshot);
  });
});
