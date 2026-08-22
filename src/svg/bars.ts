/** Rounded-data-end bar paths shared by the bar-panel cards. */

import { el, num } from './dsl.js';

/** Horizontal bar with a rounded data-end (right) and a square start (left). */
export function horizontalBar(x: number, y: number, width: number, height: number, fill: string): string {
  const r = Math.min(height / 2, width);
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
  const r = Math.min(width / 2, height);
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
