/**
 * The magnitude language shared by every card that answers "how much activity".
 *
 * Four cards encode a quantity, and they only read as one system if the mapping
 * from value to ink is identical everywhere — so it lives here instead of being
 * re-derived per card. The ramp is GitHub's own contribution green, which is
 * what ties these cards to the calendar cards a reader already understands.
 *
 * Nothing here highlights a peak with a different hue: the accent color carries
 * a categorical meaning on the composition card (commits), and a second meaning
 * would make both unreadable.
 */

import { el, textNode } from '../svg/dsl.js';
import { measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';

/**
 * Fill for a bar, in the ramp's top three steps.
 *
 * Bars encode magnitude with length, so their ink only has to reinforce it —
 * and it has to stay visible while doing so. Level 1 of the dark ramp (#0e4429)
 * sits at 1.7:1 against the dark canvas, which is fine for a 10px calendar cell
 * a reader scans as texture but not for a bar whose whole job is to be read, so
 * the bar scale starts at level 2 instead.
 */
export function barFill(theme: Theme, value: number, max: number): string {
  if (value <= 0 || max <= 0) return theme.contribRamp[0];
  const share = value / max;
  if (share > 2 / 3) return theme.contribRamp[4];
  if (share > 1 / 3) return theme.contribRamp[3];
  return theme.contribRamp[2];
}

const TICK_SIZE = 9.5; // .t-tick font-size, for measuring the captions
const CAPTION_GAP = 10;
const SWATCH = 10;
const DEFAULT_PITCH = 14;

export interface RampLegendOptions {
  /** Draw one swatch centered at (cx, cy); defaults to a rounded square. */
  readonly swatch?: (color: string, level: number, cx: number, cy: number) => string;
  /** Distance between swatch centers. Must clear the widest swatch. */
  readonly pitch?: number;
}

/** Rounded square, matching the calendar cards' cells. */
function squareSwatch(color: string, _level: number, cx: number, cy: number): string {
  return el('rect', {
    x: cx - SWATCH / 2,
    y: cy - SWATCH / 2,
    width: SWATCH,
    height: SWATCH,
    rx: 2,
    fill: color,
  });
}

/**
 * Width of the legend, independent of where it is drawn — callers right-align
 * by subtracting this from their right edge before calling `rampLegend`.
 */
export function rampLegendWidth(pitch: number = DEFAULT_PITCH): number {
  return measureMono('Less', TICK_SIZE) + CAPTION_GAP + pitch * 5 + CAPTION_GAP + measureMono('More', TICK_SIZE);
}

/** "Less ▪▪▪▪▪ More" with `x` at the left edge and `y` on the caption baseline. */
export function rampLegend(theme: Theme, x: number, y: number, options: RampLegendOptions = {}): string {
  const swatch = options.swatch ?? squareSwatch;
  const pitch = options.pitch ?? DEFAULT_PITCH;
  const firstCenter = x + measureMono('Less', TICK_SIZE) + CAPTION_GAP + pitch / 2;
  // A 9.5px cap sitting on the baseline centers about 4px above it.
  const cy = y - 4;
  const moreX = firstCenter + (theme.contribRamp.length - 0.5) * pitch + CAPTION_GAP;
  return (
    el('text', { x, y, class: 't-tick' }, textNode('Less')) +
    theme.contribRamp.map((color, level) => swatch(color, level, firstCenter + level * pitch, cy)).join('') +
    el('text', { x: moreX, y, class: 't-tick' }, textNode('More'))
  );
}
