/** Rounded-data-end bar paths shared by the bar-panel cards. */

import { el, num } from './dsl.js';

/**
 * Largest corner radius on a data end. A wide bar rounded by half its width
 * turns into a dome; capping the radius keeps every bar in the deck reading as
 * a bar with a softened end.
 */
const MAX_END_RADIUS = 6;

/** Horizontal bar with a rounded data-end (right) and a square start (left). */
export function horizontalBar(x: number, y: number, width: number, height: number, fill: string): string {
  const r = Math.min(height / 2, width, MAX_END_RADIUS);
  const right = x + width;
  const bottom = y + height;
  const d =
    `M${num(x)} ${num(y)}` +
    `H${num(right - r)}` +
    `Q${num(right)} ${num(y)} ${num(right)} ${num(y + r)}` +
    `V${num(bottom - r)}` +
    `Q${num(right)} ${num(bottom)} ${num(right - r)} ${num(bottom)}` +
    `H${num(x)}Z`;
  return el('path', { d, fill });
}

/** Vertical bar with a rounded data-end (top) and a square baseline. */
export function verticalBar(x: number, baseline: number, width: number, height: number, fill: string): string {
  const r = Math.min(width / 2, height, MAX_END_RADIUS);
  const top = baseline - height;
  const d =
    `M${num(x)} ${num(baseline)}` +
    `V${num(top + r)}` +
    `Q${num(x)} ${num(top)} ${num(x + r)} ${num(top)}` +
    `H${num(x + width - r)}` +
    `Q${num(x + width)} ${num(top)} ${num(x + width)} ${num(top + r)}` +
    `V${num(baseline)}Z`;
  return el('path', { d, fill });
}
