/** Squarified treemap layout (Bruls, Huizing, van Wijk 2000). */

export interface TreemapRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Index into the input `weights` array this rect represents. */
  readonly index: number;
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
): TreemapRect[] {
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

  const rects: TreemapRect[] = [];
  let free: Rect = { x, y, width, height };
  let row: Item[] = [];
  let cursor = 0;
  while (cursor < items.length) {
    const item = items[cursor];
    if (item === undefined) break;
    const side = Math.min(free.width, free.height);
    // Add the item while it does not worsen the row's worst aspect ratio; the
    // worst ratio falls then rises as a row fills, so the first increase marks
    // the optimal break point.
    if (row.length === 0 || worstRatio(row, side) >= worstRatio([...row, item], side)) {
      row.push(item);
      cursor += 1;
    } else {
      free = layoutRow(row, free, rects, false);
      row = [];
    }
  }
  // The trailing row consumes all remaining area, so fill the free rect exactly.
  if (row.length > 0) layoutRow(row, free, rects, true);

  return rects;
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
 * Return the worst (largest) aspect ratio produced by laying `row` against a
 * strip of length `side`. An empty row imposes no constraint, so its worst
 * ratio is +Infinity — adding the first item always improves the row.
 */
function worstRatio(row: readonly Item[], side: number): number {
  if (row.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  let max = 0;
  let min = Number.POSITIVE_INFINITY;
  for (const item of row) {
    sum += item.area;
    if (item.area > max) max = item.area;
    if (item.area < min) min = item.area;
  }
  const side2 = side * side;
  const sum2 = sum * sum;
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

/**
 * Place `row` as one strip along the shorter side of `free`, pushing a rect per
 * item, and return the remaining free rect. The last item snaps to the strip's
 * far edge to absorb floating-point drift; when `fill` is set the strip spans
 * the whole longer side so the final row tiles the rect exactly.
 */
function layoutRow(row: readonly Item[], free: Rect, out: TreemapRect[], fill: boolean): Rect {
  let rowArea = 0;
  for (const item of row) rowArea += item.area;
  const last = row.length - 1;

  if (free.width <= free.height) {
    // Horizontal strip across the top; items run along the width (short side).
    const thickness = fill ? free.height : Math.min(rowArea / free.width, free.height);
    let offset = free.x;
    row.forEach((item, position) => {
      const length = item.area / thickness;
      const w = position === last ? Math.max(0, free.x + free.width - offset) : length;
      out.push({ x: offset, y: free.y, width: w, height: thickness, index: item.index });
      offset += length;
    });
    return {
      x: free.x,
      y: free.y + thickness,
      width: free.width,
      height: Math.max(0, free.height - thickness),
    };
  }

  // Vertical strip down the left; items run along the height (short side).
  const thickness = fill ? free.width : Math.min(rowArea / free.height, free.width);
  let offset = free.y;
  row.forEach((item, position) => {
    const length = item.area / thickness;
    const h = position === last ? Math.max(0, free.y + free.height - offset) : length;
    out.push({ x: free.x, y: offset, width: thickness, height: h, index: item.index });
    offset += length;
  });
  return {
    x: free.x + thickness,
    y: free.y,
    width: Math.max(0, free.width - thickness),
    height: free.height,
  };
}
