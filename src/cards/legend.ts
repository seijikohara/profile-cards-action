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
import { formatInt, measureMono } from '../svg/text.js';
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

/** Extra height a numeric legend needs below its baseline for the caption row. */
export const RAMP_SCALE_ROW = 12;

/** Thresholds a card's ramp encodes, and what one unit of it counts. */
export interface RampScale {
  /** Lower bounds of levels 1..4, non-decreasing. */
  readonly thresholds: readonly [number, number, number, number];
  /** What the numbers count, e.g. "per day". Replaces the "Less" caption. */
  readonly unit: string;
}

export interface RampLegendOptions {
  /** Draw one swatch centered at (cx, cy); defaults to a rounded square. */
  readonly swatch?: (color: string, level: number, cx: number, cy: number) => string;
  /** Distance between swatch centers. Must clear the widest swatch. */
  readonly pitch?: number;
  /**
   * Replace "Less … More" with the value band each step stands for.
   *
   * Every card that draws a ramp already computes these bounds and then throws
   * them away, leaving the reader to guess what one shade of green is worth.
   * Ignored when the distribution is empty, where every band would read 0.
   */
  readonly scale?: RampScale;
}

/**
 * Caption per level: the half-open band each step covers, with the top step
 * open-ended. An empty band — two thresholds that coincide, because no value
 * landed between them — reads as a dash rather than as a backwards range.
 */
function band(lo: number, hi: number): string {
  return hi < lo ? '—' : lo === hi ? formatInt(lo) : `${formatInt(lo)}–${formatInt(hi)}`;
}

function scaleCaptions(scale: RampScale): string[] {
  const [q1, q2, q3, q4] = scale.thresholds;
  return ['0', band(q1, q2 - 1), band(q2, q3 - 1), band(q3, q4 - 1), `${formatInt(q4)}+`];
}

/** The scale to draw, or undefined when its distribution carries no information. */
function usableScale(options: RampLegendOptions): RampScale | undefined {
  const scale = options.scale;
  return scale === undefined || scale.thresholds[3] <= 0 ? undefined : scale;
}

/** Layout shared by `rampLegend` and `rampLegendWidth`, so they cannot drift. */
function layout(options: RampLegendOptions): { lead: string; captions: string[] | undefined; pitch: number } {
  const scale = usableScale(options);
  const captions = scale === undefined ? undefined : scaleCaptions(scale);
  const widest = captions === undefined ? 0 : Math.max(...captions.map((caption) => measureMono(caption, TICK_SIZE)));
  return {
    lead: scale?.unit ?? 'Less',
    captions,
    // A numeric legend's pitch is set by its widest caption, not by its swatch.
    pitch: Math.max(options.pitch ?? DEFAULT_PITCH, widest + 8),
  };
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
export function rampLegendWidth(options: RampLegendOptions = {}): number {
  const { lead, captions, pitch } = layout(options);
  const trailing = captions === undefined ? CAPTION_GAP + measureMono('More', TICK_SIZE) : 0;
  return measureMono(lead, TICK_SIZE) + CAPTION_GAP + pitch * 5 + trailing;
}

/**
 * "Less ▪▪▪▪▪ More" with `x` at the left edge and `y` on the caption baseline,
 * or — when `scale` is given — the same swatch row over a caption row naming
 * the value band each step covers.
 */
export function rampLegend(theme: Theme, x: number, y: number, options: RampLegendOptions = {}): string {
  const swatch = options.swatch ?? squareSwatch;
  const { lead, captions, pitch } = layout(options);
  const firstCenter = x + measureMono(lead, TICK_SIZE) + CAPTION_GAP + pitch / 2;
  // A 9.5px cap sitting on the baseline centers about 4px above it.
  const cy = y - 4;
  const centerOf = (level: number): number => firstCenter + level * pitch;
  const swatches = theme.contribRamp.map((color, level) => swatch(color, level, centerOf(level), cy)).join('');
  const trailing =
    captions === undefined
      ? el('text', { x: centerOf(theme.contribRamp.length - 0.5) + CAPTION_GAP, y, class: 't-tick' }, textNode('More'))
      : captions
          .map((caption, level) =>
            el(
              'text',
              { x: centerOf(level), y: y + RAMP_SCALE_ROW - 1, class: 't-tick', 'text-anchor': 'middle' },
              textNode(caption)
            )
          )
          .join('');
  return el('text', { x, y, class: 't-tick' }, textNode(lead)) + swatches + trailing;
}

/**
 * Provenance caption for a card's note slot.
 *
 * A contribution count that omits private work and one that includes it are
 * different numbers, and nothing on the card distinguishes them. Naming which
 * one is drawn is the difference between a quiet year and a private one.
 */
export function privacyNote(includesPrivate: boolean): string {
  return includesPrivate ? 'incl. private' : 'public only';
}
