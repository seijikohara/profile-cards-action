/** Sparklines: a series small enough to sit inside a stat tile. */

import type { Theme } from '../theme.js';
import { el, num } from './dsl.js';

/**
 * Baseline-anchored sparkline of `values`, left to right.
 *
 * Anchored at zero rather than at the series minimum: a tile has no axis, so a
 * floating baseline would turn a 3% wobble into a mountain range. The last
 * value carries a dot, because "where it is now" is the reason the shape is
 * there at all.
 *
 * Returns '' for a series with nothing to draw, so callers can concatenate.
 */
export function sparkline(
  values: readonly number[],
  x: number,
  baseline: number,
  width: number,
  height: number,
  theme: Theme,
  partialLast = false
): string {
  const max = Math.max(0, ...values);
  if (values.length < 2 || max === 0) return '';

  const step = width / (values.length - 1);
  const points = values.map((value, index) => ({
    x: x + index * step,
    y: baseline - (value / max) * height,
  }));
  const path = points.map((point) => `${num(point.x)} ${num(point.y)}`).join('L');
  const last = points.at(-1);
  // A period still in progress (this year, this month) always looks like a
  // drop. Its segment is dashed and its dot hollow, so the shape reads as
  // "so far" rather than as a collapse.
  const settled = partialLast ? points.slice(0, -1) : points;
  const settledPath = settled.map((point) => `${num(point.x)} ${num(point.y)}`).join('L');
  const before = settled.at(-1);
  const stroke = { fill: 'none', stroke: theme.contribRamp[3], 'stroke-width': 1.5, 'stroke-linejoin': 'round' };

  return (
    el('path', {
      d: `M${num(x)} ${num(baseline)}L${path}L${num(x + width)} ${num(baseline)}Z`,
      // The frame's vertical fade, painted with stop-opacity: the reduced-motion
      // reset forces opacity to 1 on every element.
      fill: 'url(#area)',
    }) +
    el('path', { d: `M${settledPath}`, ...stroke }) +
    (!partialLast || before === undefined || last === undefined
      ? ''
      : el('path', {
          d: `M${num(before.x)} ${num(before.y)}L${num(last.x)} ${num(last.y)}`,
          ...stroke,
          'stroke-dasharray': '2 2',
        })) +
    (last === undefined
      ? ''
      : partialLast
        ? el('circle', {
            cx: last.x,
            cy: last.y,
            r: 2.2,
            fill: theme.bgInset,
            stroke: theme.contribRamp[4],
            'stroke-width': 1.2,
          })
        : el('circle', { cx: last.x, cy: last.y, r: 2.2, fill: theme.contribRamp[4] }))
  );
}

/**
 * Triangle marking the direction of a change, drawn as a path.
 *
 * The embedded font is subset to the glyphs the cards use, so a ▲ character
 * would render as tofu or silently vanish.
 */
export function deltaTriangle(cx: number, cy: number, rising: boolean, fill: string): string {
  const half = 3.4;
  const rise = 3.8;
  const d = rising
    ? `M${num(cx - half)} ${num(cy + rise / 2)}L${num(cx + half)} ${num(cy + rise / 2)}L${num(cx)} ${num(cy - rise)}Z`
    : `M${num(cx - half)} ${num(cy - rise / 2)}L${num(cx + half)} ${num(cy - rise / 2)}L${num(cx)} ${num(cy + rise)}Z`;
  return el('path', { d, fill });
}
