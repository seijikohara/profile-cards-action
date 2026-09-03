/**
 * Commit cadence card: a weekday × hour punch card over the trailing-year
 * commit sweep, with the marginal day curve as a histogram above it.
 *
 * Dot size and fill both encode the quantile level of each cell, so the grid
 * speaks the same green as the calendar cards; the busiest cell is ringed
 * rather than recolored, because a second hue here would collide with the
 * composition card's categorical accent. Hours are the author's local clock
 * (GitTimestamp keeps the commit's UTC offset), so the card answers "when does
 * this person commit" on their own clock — and the night hours the footer
 * quantifies are shaded under the histogram.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeCadence } from '../compute/cadence.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import { range } from '../iter.js';
import { verticalBar } from '../svg/bars.js';
import { formatCompact, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { barFill, rampLegend, rampLegendWidth } from './legend.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Night runs 22:00–05:59 author-local — the window the footer's share counts. */
const NIGHT_FROM = 22;
const NIGHT_UNTIL = 6;

// Vertical rhythm of the card, in absolute user-space coordinates.
const BAND_TOP = 56; // night shading and the captions that name it
const EYEBROW_BASELINE = 68;
const HIST_MAX_HEIGHT = 30;
const HIST_BASELINE = 102;
const BAND_BOTTOM = HIST_BASELINE + 6;
const GRID_TOP = HIST_BASELINE + 20;
const ROW_H = 24;
const GRID_BOTTOM = GRID_TOP + ROW_H * WEEKDAY_LABELS.length;
const TICK_BASELINE = GRID_BOTTOM + 16;
const FOOTER_BASELINE = TICK_BASELINE + 29;

// Horizontal geometry: a label gutter wide enough to clear the "BY HOUR"
// eyebrow, then 24 equal hour columns.
const GRID_LEFT = CARD_PADDING + 52;
const GRID_W = CARD_WIDTH - CARD_PADDING - GRID_LEFT;
const COL_W = GRID_W / 24;
const HIST_BAR_W = Math.min(14, COL_W - 6);

/**
 * Dot radius per level 0..4 — area grows with activity. The level-0 dot is
 * large enough to keep the grid's ground visible in sparse regions; 1.6 read
 * as dust.
 */
const DOT_RADIUS = [2.2, 3.4, 4.6, 6, 7.4] as const;

// The legend's dots reproduce the grid's size ramp, so its pitch has to clear
// the widest one.
const LEGEND_PITCH = 18;

/** Left edge of the hour column `hour`. */
function columnX(hour: number): number {
  return GRID_LEFT + hour * COL_W;
}

export function renderCadence(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const cadence = computeCadence(data.commits);

  // Night bands shade the hour axis behind the histogram and carry their own
  // caption, so the footer's night share has something to point at. They stop
  // above the dot grid on purpose: the inset fill and the level-0 dot are a
  // hair apart in the dark theme, and shading the grid would swallow them.
  const nightBands = [
    { from: 0, until: NIGHT_UNTIL },
    { from: NIGHT_FROM, until: 24 },
  ].flatMap((band) => {
    const x = columnX(band.from);
    const width = (band.until - band.from) * COL_W;
    return [
      el('rect', { x, y: BAND_TOP, width, height: BAND_BOTTOM - BAND_TOP, rx: 3, fill: theme.bgInset }),
      el(
        'text',
        { x: x + width / 2, y: EYEBROW_BASELINE, class: 't-mono', 'text-anchor': 'middle' },
        textNode('NIGHT')
      ),
    ];
  });

  // The histogram's floor, drawn full width so an hour with no commits still
  // reads as a gap on an axis rather than as missing ink.
  const histBaseline = el('line', {
    x1: GRID_LEFT,
    y1: HIST_BASELINE + 0.5,
    x2: CARD_WIDTH - CARD_PADDING,
    y2: HIST_BASELINE + 0.5,
    stroke: theme.border,
    'stroke-width': 1,
  });

  // Marginal day curve: the grid's column sums. The punch card shows when in
  // the week; this shows the shape of a day, which no other card carries.
  const hourMax = Math.max(0, ...cadence.hourTotals);
  const histogram = cadence.hourTotals.map((total, hour) => {
    const height = total === 0 || hourMax === 0 ? 0 : Math.max(2, (total / hourMax) * HIST_MAX_HEIGHT);
    if (height === 0) return '';
    return verticalBar(
      columnX(hour) + (COL_W - HIST_BAR_W) / 2,
      HIST_BASELINE,
      HIST_BAR_W,
      height,
      barFill(theme, total, hourMax)
    );
  });

  // One group per hour column so the entry stagger costs 24 style attributes,
  // not 168.
  const columns = range(24).map((hour) => {
    const cx = columnX(hour) + COL_W / 2;
    const dots = cadence.levels.map((row, weekday) => {
      const level = row[hour] ?? 0;
      const cy = GRID_TOP + weekday * ROW_H + ROW_H / 2;
      const isPeak = cadence.peak !== undefined && cadence.peak.weekday === weekday && cadence.peak.hour === hour;
      return (
        el('circle', { cx, cy, r: DOT_RADIUS[level], fill: theme.contribRamp[level] }) +
        (isPeak ? peakRing(cx, cy, level, theme) : '')
      );
    });
    return el('g', { class: 'dot', style: `animation-delay:${hour * 14}ms` }, ...dots);
  });

  const weekdayLabels = WEEKDAY_LABELS.map((label, index) =>
    el(
      'text',
      { x: GRID_LEFT - 10, y: GRID_TOP + index * ROW_H + ROW_H / 2 + 4, class: 't-label', 'text-anchor': 'end' },
      textNode(label)
    )
  );

  const hourTicks = range(12).map((half) => {
    const hour = half * 2;
    return el(
      'text',
      { x: columnX(hour) + COL_W / 2, y: TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' },
      textNode(String(hour))
    );
  });

  const eyebrow = el('text', { x: CARD_PADDING, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('BY HOUR'));

  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatCompact(cadence.totalCommits))),
    textNode(' commits'),
  ];
  if (cadence.peak !== undefined) {
    const peakLabel = `${WEEKDAY_LABELS[cadence.peak.weekday] ?? ''} ${String(cadence.peak.hour).padStart(2, '0')}:00`;
    footerParts.push(textNode(' · peak '), el('tspan', { class: 't-stat' }, textNode(peakLabel)));
  }
  footerParts.push(
    textNode(' · '),
    el('tspan', { class: 't-stat' }, textNode(`+${formatCompact(cadence.additions)}`)),
    textNode(' '),
    el('tspan', { class: 't-stat' }, textNode(`−${formatCompact(cadence.deletions)}`)),
    textNode(' lines')
  );
  if (cadence.totalCommits > 0) {
    footerParts.push(
      textNode(' · '),
      el('tspan', { class: 't-stat' }, textNode(`${Math.round(cadence.nightShare * 100)}%`)),
      textNode(` at night (${NIGHT_FROM}-0${NIGHT_UNTIL})`)
    );
  }
  const footer = el('text', { x: CARD_PADDING, y: FOOTER_BASELINE, class: 't-label' }, ...footerParts);

  // Color and dot size are the grid's only quantity channels, so this card is
  // the one that has to spell the ramp out.
  const legendX = CARD_WIDTH - CARD_PADDING - rampLegendWidth(LEGEND_PITCH);
  const legend = rampLegend(theme, legendX, FOOTER_BASELINE, {
    pitch: LEGEND_PITCH,
    swatch: (color, level, cx, cy) => el('circle', { cx, cy, r: DOT_RADIUS[level], fill: color }),
  });
  const peakKey =
    cadence.peak === undefined ? '' : peakKeyChip(legendX - 18 - measureMono('peak', 9.5) - 14, FOOTER_BASELINE, theme);

  const height = FOOTER_BASELINE + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: 'Commit cadence',
      note: 'trailing 12 months · author local time',
      description: `Commit cadence for ${data.login}: commits by weekday and hour of day over the trailing year.`,
      extraCss: `.dot{opacity:0;animation:fade .45s ease forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, ...nightBands, eyebrow, histBaseline, ...histogram, ...weekdayLabels, ...hourTicks),
    ...columns,
    el('g', { class: 'fade' }, footer, peakKey, legend)
  );
}

/** Hue-free emphasis for the busiest cell: a thin ring in the foreground ink. */
function peakRing(cx: number, cy: number, level: 0 | 1 | 2 | 3 | 4, theme: Theme): string {
  return el('circle', {
    cx,
    cy,
    r: DOT_RADIUS[level] + 3.4,
    fill: 'none',
    stroke: theme.fg,
    'stroke-width': 1.2,
  });
}

/** Legend chip naming the ring, drawn at `x` on the `y` baseline. */
function peakKeyChip(x: number, y: number, theme: Theme): string {
  return (
    el('circle', { cx: x + 6, cy: y - 4, r: 2.6, fill: theme.contribRamp[4] }) +
    el('circle', { cx: x + 6, cy: y - 4, r: 6, fill: 'none', stroke: theme.fg, 'stroke-width': 1.2 }) +
    el('text', { x: x + 17, y, class: 't-tick' }, textNode('peak'))
  );
}
