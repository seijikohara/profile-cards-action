/**
 * The deck's few depth effects: paint servers and filters, tuned per color mode.
 *
 * Each mark type gets at most one effect, and only where it says something:
 * a long bar's data end, a line's current value, a raised tile, an object
 * resting on a floor. Nothing tints a color that identifies something (the
 * language colors keep their exact values). Glow is reserved for the dark theme, where light reads as emphasis;
 * on a white canvas the same blur reads as smudge, so the light theme gets
 * shadow instead. Every translucency is a stop/flood/fill opacity — the
 * reduced-motion reset forces the `opacity` property to 1 on every element.
 */

import { CARD_WIDTH } from '../config.js';
import { oklchLightness, shiftLightness, type Theme } from '../theme.js';
import { el } from './dsl.js';

/**
 * Bars shorter than this stay solid. The fade spans the bar's own box, so on a
 * short bar the whole lightness step lands in a few pixels and reads as a
 * blotch rather than a direction.
 */
export const MIN_FADE_LENGTH = 48;

/**
 * Paint for a bar of `length` px filled with ramp step `color`: the same hue,
 * its base faded toward the canvas. Short bars and colors outside the ramp
 * stay solid.
 */
export function barPaint(theme: Theme, color: string, axis: 'x' | 'y', length: number): string {
  const level = theme.contribRamp.indexOf(color);
  return level < 0 || length < MIN_FADE_LENGTH ? color : `url(#bar-${axis}-${level})`;
}
/** Filter that lifts an inset panel off the card (light theme only). */
export const LIFT = 'url(#lift)';
/** Filter that softens a duplicate stroke into a glow (dark theme only). */
export const GLOW = 'url(#glow-blur)';
/** Filter that softens a ground silhouette into a contact shadow. */
export const GROUND = 'url(#ground-blur)';

// Blur filters cover the whole card in user space: a bounding-box region is
// sized from the element, and a nearly flat line would clip its own glow.
const BLUR_REGION = { filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: CARD_WIDTH, height: 1600 } as const;

// How far a bar's base sits from its data end in OKLCH lightness, toward the
// canvas: lighter on white, darker on the dark canvas. Enough to lead the eye
// to the end that carries the value; the data end keeps the exact ramp color.
const BAR_FADE = { light: 0.07, dark: -0.08 } as const;

// The faded base never comes closer to the track than this, or the start of a
// faint bar dissolves into its track and the bar looks shorter than it is.
const TRACK_CLEARANCE = 0.1;

/** The bar's base color: faded toward the canvas, but held clear of the track. */
function fadedBase(color: string, theme: Theme): string {
  const lightness = oklchLightness(color);
  const track = oklchLightness(theme.track);
  const target =
    theme.id === 'light'
      ? Math.min(lightness + BAR_FADE.light, Math.max(lightness, track - TRACK_CLEARANCE))
      : Math.max(lightness + BAR_FADE.dark, Math.min(lightness, track + TRACK_CLEARANCE));
  return shiftLightness(color, target - lightness);
}

function stop(offset: number, color: string, opacity: number): string {
  return el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });
}

/** One drop-shadow layer: blurred, offset alpha flooded with `color`. */
function shadowLayer(blur: number, dy: number, color: string, opacity: number, result: string): string {
  return (
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: blur, result: `${result}-blur` }) +
    el('feOffset', { in: `${result}-blur`, dy, result: `${result}-offset` }) +
    el('feFlood', { 'flood-color': color, 'flood-opacity': opacity, result: `${result}-flood` }) +
    el('feComposite', { in: `${result}-flood`, in2: `${result}-offset`, operator: 'in', result })
  );
}

/** Definitions every card can reference; emitted once inside the frame's <defs>. */
export function effectDefs(theme: Theme): string {
  return [
    ...theme.contribRamp.flatMap((color, level) => {
      const base = fadedBase(color, theme);
      return [
        el('linearGradient', { id: `bar-x-${level}`, x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, base, 1), stop(1, color, 1)),
        el('linearGradient', { id: `bar-y-${level}`, x1: 0, y1: 1, x2: 0, y2: 0 }, stop(0, base, 1), stop(1, color, 1)),
      ];
    }),
    // A tight contact shadow plus a wide ambient one: a single layer reads
    // either as a hard edge or as fog.
    el(
      'filter',
      { id: 'lift', x: '-10%', y: '-15%', width: '120%', height: '150%' },
      shadowLayer(1, 1, '#1f2328', 0.07, 'contact'),
      shadowLayer(6, 4, '#1f2328', 0.05, 'ambient'),
      el(
        'feMerge',
        {},
        el('feMergeNode', { in: 'ambient' }),
        el('feMergeNode', { in: 'contact' }),
        el('feMergeNode', { in: 'SourceGraphic' })
      )
    ),
    el('filter', { id: 'glow-blur', ...BLUR_REGION }, el('feGaussianBlur', { stdDeviation: 2.5 })),
    el('filter', { id: 'ground-blur', ...BLUR_REGION }, el('feGaussianBlur', { stdDeviation: 7 })),
  ].join('');
}
