/**
 * Momentum card: the trailing-twelve-month contribution total, sampled weekly
 * across the whole account history.
 *
 * The deck's other time series are cumulative or per-period; this is the only
 * one that can fall. That is the point — a rolling window is the same data as a
 * running total, drawn so a quiet year reads as a decline instead of a plateau.
 *
 * One green: the stroke is the ramp's top step and the area its third, so the
 * card sits in the same magnitude language as the calendars. The all-time peak
 * is marked with a foreground-ink ring, never a second hue.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeMomentum, type MomentumPoint } from '../compute/momentum.js';
import { range } from '../iter.js';
import type { ProfileData } from '../model.js';
import { el, num, textNode } from '../svg/dsl.js';
import { formatDate, formatInt, formatMonthYear, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';

// Vertical rhythm, in absolute user-space coordinates.
const PLOT_TOP = 84;
const PLOT_HEIGHT = 168;
const PLOT_BOTTOM = PLOT_TOP + PLOT_HEIGHT;
const TICK_BASELINE = PLOT_BOTTOM + 17;
const FOOTER_BASELINE = TICK_BASELINE + 28;

// The right gutter holds the current value, so the line stops short of it.
const VALUE_GUTTER = 66;
const PLOT_X = CARD_PADDING;
const PLOT_WIDTH = CARD_WIDTH - CARD_PADDING * 2 - VALUE_GUTTER;

/** Headroom above the peak so its ring and label are not clipped by the frame. */
const Y_HEADROOM = 1.12;

/** Year ticks closer than this collapse into their neighbour. */
const MIN_TICK_GAP = 34;

/** Height of the "not enough history yet" stub, matching the languages card. */
const STUB_HEIGHT = 96;

export function renderMomentum(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const momentum = computeMomentum(data.lifetimeDays, data.years);
  const { points, peak, current, since } = momentum;

  // Two points is a segment, not a trend. Below that the card would draw a
  // shape the data cannot support, so it says so instead.
  if (points.length < 2 || peak === undefined || current === undefined || since === undefined) {
    return cardFrame(
      {
        theme,
        height: STUB_HEIGHT,
        title: 'Momentum',
        note: 'rolling 12 months',
        description: `Momentum for ${data.login}: not enough history to draw a rolling year.`,
        fontFaceCss,
      },
      el('text', { x: CARD_PADDING, y: 72, class: 't-label' }, textNode('Needs more than a year of history'))
    );
  }

  const maxTotal = Math.max(...points.map((point) => point.total));
  const scaleY = maxTotal === 0 ? 0 : PLOT_HEIGHT / (maxTotal * Y_HEADROOM);
  const y = (total: number): number => PLOT_BOTTOM - total * scaleY;
  const x = (index: number): number => PLOT_X + (index / (points.length - 1)) * PLOT_WIDTH;

  const vertices = points.map((point, index) => `${num(x(index))} ${num(y(point.total))}`);
  const line = el('path', {
    d: `M${vertices.join('L')}`,
    fill: 'none',
    stroke: theme.contribRamp[4],
    'stroke-width': 2,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  });
  const area = el('path', {
    d: `M${num(PLOT_X)} ${num(PLOT_BOTTOM)}L${vertices.join('L')}L${num(x(points.length - 1))} ${num(PLOT_BOTTOM)}Z`,
    fill: theme.contribRamp[2],
    // fill-opacity, not opacity: the frame's reduced-motion reset forces
    // `opacity: 1` on every element, which would flood the plot solid green.
    'fill-opacity': 0.16,
  });

  const baselineRule = el('line', {
    x1: PLOT_X,
    y1: PLOT_BOTTOM + 0.5,
    x2: CARD_WIDTH - CARD_PADDING,
    y2: PLOT_BOTTOM + 0.5,
    stroke: theme.border,
    'stroke-width': 1,
  });

  // One tick per January that clears its neighbour. The series is weekly, so a
  // year's tick sits on the first sample of that year.
  const ticks = yearTicks(points).reduce<{ readonly marks: readonly string[]; readonly lastX: number }>(
    (acc, tick) => {
      const tx = x(tick.index);
      if (tx - acc.lastX < MIN_TICK_GAP) return acc;
      return {
        lastX: tx,
        marks: [
          ...acc.marks,
          el(
            'text',
            { x: tx, y: TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' },
            textNode(String(tick.year))
          ),
        ],
      };
    },
    { marks: [], lastX: Number.NEGATIVE_INFINITY }
  ).marks;

  // Mark the all-time peak — unless it is where the line already ends, where
  // the ring would sit under the end cap and repeat the number beside it.
  const peakMark = peak.date === current.date ? '' : peakMarker(peak, points, theme, x, y);

  // The current value is the number a reader wants first, so it sits at the
  // line's end rather than in the footer. Clamped into the plot band.
  const currentY = Math.min(PLOT_BOTTOM - 4, Math.max(PLOT_TOP + 20, y(current.total) + 9));
  const currentValue =
    el('circle', { cx: x(points.length - 1), cy: y(current.total), r: 3.2, fill: theme.contribRamp[4] }) +
    el('text', { x: PLOT_X + PLOT_WIDTH + 12, y: currentY, class: 't-value' }, textNode(formatInt(current.total)));

  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatInt(momentum.lifetimeTotal))),
    textNode(` contributions since ${formatDate(since, true)} · trailing year `),
    el('tspan', { class: 't-stat' }, textNode(formatInt(current.total))),
    textNode(' · peak '),
    el('tspan', { class: 't-stat' }, textNode(formatMonthYear(peak.date))),
  ];
  if (momentum.quietestYear !== undefined) {
    footerParts.push(
      textNode(' · quietest year '),
      el('tspan', { class: 't-stat' }, textNode(String(momentum.quietestYear.year)))
    );
  }
  const footer = el('text', { x: CARD_PADDING, y: FOOTER_BASELINE, class: 't-label' }, ...footerParts);

  // A left-to-right reveal reads as time passing, which is what the axis is.
  // The frame's reduced-motion reset cannot undo a clip-path, so this one does.
  const extraCss =
    `.sweep{clip-path:inset(0 100% 0 0);animation:sweep 1.1s cubic-bezier(.2,.7,.3,1) .1s forwards}` +
    `@keyframes sweep{to{clip-path:inset(0 0 0 0)}}` +
    `@media (prefers-reduced-motion: reduce){.sweep{clip-path:none!important}}`;

  return cardFrame(
    {
      theme,
      height: FOOTER_BASELINE + CARD_PADDING,
      title: 'Momentum',
      note: 'rolling 12 months · all contribution types',
      description:
        `Momentum for ${data.login}: contributions in each trailing twelve months since ` +
        `${formatDate(since, true)}, currently ${formatInt(current.total)}, peaking at ${formatInt(peak.total)}.`,
      extraCss,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, baselineRule, ...ticks),
    el('g', { class: 'sweep' }, area, line),
    el('g', { class: 'fade' }, peakMark, currentValue, footer)
  );
}

/** Ringed peak plus its value, flipped inboard when it would leave the plot. */
function peakMarker(
  peak: MomentumPoint,
  points: readonly MomentumPoint[],
  theme: Theme,
  x: (index: number) => number,
  y: (total: number) => number
): string {
  const cx = x(points.indexOf(peak));
  const cy = y(peak.total);
  const label = `peak ${formatInt(peak.total)}`;
  const flip = cx + measureMono(label, 9.5) + 14 > PLOT_X + PLOT_WIDTH;
  return (
    el('circle', { cx, cy, r: 4.5, fill: 'none', stroke: theme.fg, 'stroke-width': 1.4 }) +
    el(
      'text',
      { x: cx + (flip ? -10 : 10), y: cy - 8, class: 't-tick', 'text-anchor': flip ? 'end' : 'start' },
      textNode(label)
    )
  );
}

/** Index of the first sample in each calendar year the series covers. */
function yearTicks(points: readonly MomentumPoint[]): { readonly index: number; readonly year: number }[] {
  return range(points.length).flatMap((index) => {
    const year = points[index]?.date.slice(0, 4);
    const previous = index === 0 ? undefined : points[index - 1]?.date.slice(0, 4);
    return year !== undefined && year !== previous ? [{ index, year: Number(year) }] : [];
  });
}
