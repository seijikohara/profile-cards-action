/** Dashed guide lines: present enough to read a value against, quiet enough to ignore. */

import type { Theme } from '../theme.js';
import { el } from './dsl.js';

const DASH = '2 4';

/** Horizontal guide at `y`, snapped to the pixel grid so the hairline stays crisp. */
export function hGuide(x1: number, x2: number, y: number, theme: Theme): string {
  const crisp = Math.round(y) + 0.5;
  return el('line', {
    x1,
    y1: crisp,
    x2,
    y2: crisp,
    stroke: theme.borderMuted,
    'stroke-width': 1,
    'stroke-dasharray': DASH,
  });
}

/** Vertical guide at `x`, snapped to the pixel grid. */
export function vGuide(x: number, y1: number, y2: number, theme: Theme): string {
  const crisp = Math.round(x) + 0.5;
  return el('line', {
    x1: crisp,
    y1,
    x2: crisp,
    y2,
    stroke: theme.borderMuted,
    'stroke-width': 1,
    'stroke-dasharray': DASH,
  });
}

/**
 * A round step that splits `max` into about `count` intervals: 1, 2, 2.5, or 5
 * times a power of ten, so guide labels read as 500 / 1k / 1.5k, never 1,337.
 */
export function niceStep(max: number, count: number): number {
  if (max <= 0 || count <= 0) return 0;
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= raw) ?? 10;
  return factor * magnitude;
}
