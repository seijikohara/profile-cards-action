/** Lucide icons, inlined as stroked paths. */

import type { IconNode } from 'lucide';
import { el } from './dsl.js';

/**
 * Draw a Lucide icon in a `size`-pixel box whose top-left corner is (x, y).
 *
 * A nested <svg> places and scales the 24-unit icon grid instead of a
 * `transform` attribute: the frame's reduced-motion rule sets the CSS
 * `transform` property to none on every element, and that property overrides
 * the attribute, which would drop every icon at the origin at full size.
 *
 * Stroke color is set explicitly; `currentColor` has no `color` to inherit
 * inside an image.
 */
export function icon(node: IconNode, x: number, y: number, size: number, color: string): string {
  return el(
    'svg',
    {
      x,
      y,
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    ...node.map(([tag, attrs]) => el(tag, attrs))
  );
}
