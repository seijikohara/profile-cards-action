/** Squarified treemap layout (Bruls, Huizing, van Wijk 2000). */

import { range } from '../iter.js';

export interface TreemapRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Index into the input `weights` array this rect represents. */
  readonly index: number;
}

interface Item {
  readonly index: number;
  readonly area: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Squarified treemap. Lay out `weights` (all > 0) inside the rect (x, y, width,
 * height), returning one rect per weight, area proportional to the weight,
 * minimizing aspect ratios (Bruls et al. squarified algorithm). Output order may
 * be any, but each rect MUST carry its original `index` into `weights`.
 */
export function squarify(
  weights: readonly number[],
  x: number,
  y: number,
  width: number,
  height: number
): readonly TreemapRect[] {
  if (weights.length === 0) return [];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const boundingArea = width * height;

  // Scale weights to areas so their sum equals the bounding area, then lay out
  // largest-first for squareness. Original indices ride along untouched so
  // callers can map color/label back; ties break by index for determinism.
  const items: readonly Item[] = weights
    .map((weight, index) => ({
      index,
      area: (weight / totalWeight) * boundingArea,
    }))
    .toSorted((a, b) => b.area - a.area || a.index - b.index);

  return layoutItems(items, { x, y, width, height });
}

/**
 * Lay `items` into `free`, one squarified row at a time. Each row grows while
 * adding the next item does not worsen the row's worst aspect ratio — the
 * worst ratio falls then rises as a row fills, so the first increase marks the
 * optimal break point. The final row consumes all remaining area.
 */
function layoutItems(items: readonly Item[], free: Rect): readonly TreemapRect[] {
  if (items.length === 0) return [];
  const side = Math.min(free.width, free.height);
  const rowLength =
    range(items.length - 1, 1).find(
      (length) => worstRatio(items.slice(0, length), side) < worstRatio(items.slice(0, length + 1), side)
    ) ?? items.length;
  const rest = items.slice(rowLength);
  const { rects, remaining } = layoutRow(items.slice(0, rowLength), free, rest.length === 0);
  return [...rects, ...layoutItems(rest, remaining)];
}

/**
 * Return the worst (largest) aspect ratio produced by laying `row` against a
 * strip of length `side`. An empty row imposes no constraint, so its worst
 * ratio is +Infinity — adding the first item always improves the row.
 */
function worstRatio(row: readonly Item[], side: number): number {
  if (row.length === 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((total, item) => total + item.area, 0);
  const max = row.reduce((best, item) => Math.max(best, item.area), 0);
  const min = row.reduce((best, item) => Math.min(best, item.area), Number.POSITIVE_INFINITY);
  const side2 = side * side;
  const sum2 = sum * sum;
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

/**
 * Place `row` as one strip along the shorter side of `free`, returning a rect
 * per item plus the remaining free rect. The last item snaps to the strip's
 * far edge to absorb floating-point drift; when `fill` is set the strip spans
 * the whole longer side so the final row tiles the rect exactly.
 */
function layoutRow(
  row: readonly Item[],
  free: Rect,
  fill: boolean
): { readonly rects: readonly TreemapRect[]; readonly remaining: Rect } {
  const rowArea = row.reduce((total, item) => total + item.area, 0);
  const last = row.length - 1;

  if (free.width <= free.height) {
    // Horizontal strip across the top; items run along the width (short side).
    const thickness = fill ? free.height : Math.min(rowArea / free.width, free.height);
    const rects = row.map((item, position) => {
      const offset = row.slice(0, position).reduce((total, prior) => total + prior.area / thickness, free.x);
      const length = item.area / thickness;
      const w = position === last ? Math.max(0, free.x + free.width - offset) : length;
      return { x: offset, y: free.y, width: w, height: thickness, index: item.index };
    });
    return {
      rects,
      remaining: {
        x: free.x,
        y: free.y + thickness,
        width: free.width,
        height: Math.max(0, free.height - thickness),
      },
    };
  }

  // Vertical strip down the left; items run along the height (short side).
  const thickness = fill ? free.width : Math.min(rowArea / free.height, free.width);
  const rects = row.map((item, position) => {
    const offset = row.slice(0, position).reduce((total, prior) => total + prior.area / thickness, free.y);
    const length = item.area / thickness;
    const h = position === last ? Math.max(0, free.y + free.height - offset) : length;
    return { x: free.x, y: offset, width: thickness, height: h, index: item.index };
  });
  return {
    rects,
    remaining: {
      x: free.x + thickness,
      y: free.y,
      width: Math.max(0, free.width - thickness),
      height: free.height,
    },
  };
}
