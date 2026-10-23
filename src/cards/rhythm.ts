/**
 * Activity rhythm card: two small-multiple panels derived from the lifetime
 * daily series — a weekday profile (horizontal bars, Mon..Sun) and a
 * month-of-year profile (vertical bars, Jan..Dec) sharing one baseline.
 *
 * The series is the contribution calendar's daily count, so the panels cover
 * every contribution type rather than commits alone; the card says so in its
 * note, because "activity" alone leaves a reader guessing. Bars take their fill
 * from the contribution ramp, so length and ink agree and the busiest bar is
 * the darkest without needing a second hue.
 *
 * Each bar also carries a dot at the trailing year's position, so the card
 * answers "and has that changed?" without a second set of bars. Both series
 * are shares of their own total on one shared axis: the comparison is between
 * shapes, not volumes, which is the only comparison an eleven-year profile and
 * a one-year window can honestly support.
 */

import { ChartColumn } from 'lucide';
import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRhythm } from '../compute/rhythm.js';
import type { ProfileData } from '../model.js';
import { barPaint } from '../svg/effects.js';
import { el, textNode } from '../svg/dsl.js';
import { horizontalBar, verticalBar } from '../svg/bars.js';
import { formatCompact, formatDate, formatInt, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { barFill } from './legend.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

// Vertical rhythm of the card, in absolute user-space coordinates.
const EYEBROW_BASELINE = 64;
const BAND_TOP = 90; // top of the tallest month bar / first weekday row
const MONTH_MAX_HEIGHT = 104;
const BASELINE_Y = BAND_TOP + MONTH_MAX_HEIGHT; // shared floor of both panels
const MONTH_TICK_BASELINE = BASELINE_Y + 15;
const FOOTER_BASELINE = MONTH_TICK_BASELINE + 29;

// Horizontal split: ~42% weekday panel, gap, ~54% month panel.
const INNER = CARD_WIDTH - CARD_PADDING * 2;
const LEFT_X = CARD_PADDING;
const LEFT_W = 335;
const PANEL_GAP = 32;
const RIGHT_X = LEFT_X + LEFT_W + PANEL_GAP;
const RIGHT_W = INNER - LEFT_W - PANEL_GAP;

// Weekday panel geometry.
const BAR_START_X = LEFT_X + 36; // bars emanate rightward from this y-axis
const WEEKDAY_BAR_H = 10;
const WEEKDAY_MAX_LEN = LEFT_X + LEFT_W - BAR_START_X - 40; // leaves room for the value column
const ROW_H = (BASELINE_Y - BAND_TOP) / WEEKDAY_LABELS.length;

// Month panel geometry.
const MONTH_BAND = RIGHT_W / MONTH_LETTERS.length;
const MONTH_BAR_W = 14;
const MONTH_VALUE_BASELINE = BAND_TOP - 8; // one aligned row of month values

// The trailing-year marker: a foreground dot, never a second hue, outlined in
// the canvas color so it separates from the bar it sits on.
const RING_R = 2.75;
const MIN_BAR = 3; // keep a tiny non-zero value visible; zero renders nothing

/**
 * The comparison needs two windows that are actually different. Below this many
 * days of history the trailing year IS most of the record, and the ring would
 * sit on the end of every bar telling the reader nothing.
 */
const MIN_HISTORY_DAYS = 550;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Whole-percent label for a [0,1] share. */
function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * Key naming the two marks, right-aligned on `baseline`. The bars are the
 * record; the ring is where the trailing year sits in its own panel.
 */
function trailingKey(theme: Theme, baseline: number): string {
  const right = CARD_WIDTH - CARD_PADDING;
  const ringCaption = 'trailing-year share';
  const barCaption = 'all-years share';
  const ringCx = right - measureMono(ringCaption, 9.5) - 6 - RING_R;
  const barTextX = ringCx - RING_R - 16;
  const barMarkX = barTextX - measureMono(barCaption, 9.5) - 18;
  return (
    horizontalBar(barMarkX, baseline - 8, 14, 8, theme.contribRamp[3]) +
    el('text', { x: barTextX, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(barCaption)) +
    ring(ringCx, baseline - 3, theme) +
    el('text', { x: right, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(ringCaption))
  );
}

/** The trailing-year marker: a solid dot outlined in the canvas color, legible on a track and on a bar alike. */
function ring(cx: number, cy: number, theme: Theme): string {
  return el('circle', { cx, cy, r: RING_R, fill: theme.fg, stroke: theme.bg, 'stroke-width': 1.5 });
}

/** Each value as a share of `total`; all zero when there is nothing to share. */
function sharesOf(values: readonly number[], total: number): readonly number[] {
  return values.map((value) => (total === 0 ? 0 : value / total));
}

/** Round a path/transform coordinate to 2 decimals — mirrors the dsl's num(). */
function coord(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function renderRhythm(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const rhythm = computeRhythm(data.lifetimeDays);
  const recent = computeRhythm(data.trailing.days);
  const comparable = data.lifetimeDays.length >= MIN_HISTORY_DAYS;

  // Both series are drawn as shares of their own total on one shared axis, so
  // a dot left of its bar's end means the day really took a smaller share of
  // the trailing year. Normalising each to its own maximum instead would put
  // two different scales on one track. Bar lengths are unchanged by this:
  // count / max and share / maxShare are the same ratio.
  const weekdayShares = sharesOf(rhythm.weekday, rhythm.total);
  const recentWeekdayShares = sharesOf(recent.weekday, recent.total);
  const monthShares = sharesOf(rhythm.month, rhythm.total);
  const recentMonthShares = sharesOf(recent.month, recent.total);
  const showRecent = comparable && recent.total > 0;
  const weekdayAxis = Math.max(0, ...weekdayShares, ...(showRecent ? recentWeekdayShares : []));
  const monthAxis = Math.max(0, ...monthShares, ...(showRecent ? recentMonthShares : []));

  // Weekday panel: seven rows, Mon..Sun top to bottom. Each bar sits in a
  // full-length track, so a short bar still reads against the panel's scale,
  // and the values line up in one column instead of trailing each bar.
  const weekdayMax = Math.max(0, ...rhythm.weekday);
  const weekdayLabels: string[] = [];
  const weekdayTracks: string[] = [];
  const weekdayBars: string[] = [];
  const weekdayMarkers: string[] = [];
  WEEKDAY_LABELS.forEach((label, index) => {
    const value = rhythm.weekday[index] ?? 0;
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    const top = rowCenter - WEEKDAY_BAR_H / 2;
    const scaled = weekdayAxis === 0 ? 0 : ((weekdayShares[index] ?? 0) / weekdayAxis) * WEEKDAY_MAX_LEN;
    const length = value === 0 ? 0 : Math.max(MIN_BAR, scaled);

    weekdayLabels.push(
      el('text', { x: BAR_START_X - 10, y: rowCenter + 4, class: 't-label', 'text-anchor': 'end' }, textNode(label)),
      el(
        'text',
        { x: LEFT_X + LEFT_W, y: rowCenter + 3.3, class: 't-num', 'text-anchor': 'end' },
        textNode(formatCompact(value))
      )
    );
    weekdayTracks.push(horizontalBar(BAR_START_X, top, WEEKDAY_MAX_LEN, WEEKDAY_BAR_H, theme.track));
    if (length > 0) {
      weekdayBars.push(
        el(
          'g',
          {
            class: 'hbar',
            style: `animation-delay:${index * 55}ms;transform-origin:${coord(BAR_START_X)}px ${coord(rowCenter)}px`,
          },
          horizontalBar(
            BAR_START_X,
            top,
            length,
            WEEKDAY_BAR_H,
            barPaint(theme, barFill(theme, value, weekdayMax), 'x', length)
          )
        )
      );
    }
    if (showRecent && weekdayAxis > 0) {
      const share = (recentWeekdayShares[index] ?? 0) / weekdayAxis;
      weekdayMarkers.push(ring(BAR_START_X + share * WEEKDAY_MAX_LEN, rowCenter, theme));
    }
  });

  // Month panel: twelve columns, Jan..Dec, filling up from a shared floor.
  // Values sit in one row above the columns, where every column can be read
  // against the same line, rather than riding on top of each bar.
  const monthMax = Math.max(0, ...rhythm.month);
  const monthTracks: string[] = [];
  const monthBars: string[] = [];
  const monthMarkers: string[] = [];
  const monthLabels: string[] = [];
  MONTH_LETTERS.forEach((letter, index) => {
    const value = rhythm.month[index] ?? 0;
    const center = RIGHT_X + index * MONTH_BAND + MONTH_BAND / 2;
    const left = center - MONTH_BAR_W / 2;
    const scaled = monthAxis === 0 ? 0 : ((monthShares[index] ?? 0) / monthAxis) * MONTH_MAX_HEIGHT;
    const height = value === 0 ? 0 : Math.max(MIN_BAR, scaled);

    monthTracks.push(verticalBar(left, BASELINE_Y, MONTH_BAR_W, MONTH_MAX_HEIGHT, theme.track));
    if (height > 0) {
      monthBars.push(
        el(
          'g',
          {
            class: 'vbar',
            style: `animation-delay:${index * 40}ms;transform-origin:${coord(center)}px ${coord(BASELINE_Y)}px`,
          },
          verticalBar(
            left,
            BASELINE_Y,
            MONTH_BAR_W,
            height,
            barPaint(theme, barFill(theme, value, monthMax), 'y', height)
          )
        )
      );
    }
    if (showRecent && monthAxis > 0) {
      const share = (recentMonthShares[index] ?? 0) / monthAxis;
      // Keep the dot inside the column's floor and rounded top.
      const cy = Math.min(
        BASELINE_Y - RING_R - 1,
        Math.max(BAND_TOP + RING_R + 1, BASELINE_Y - share * MONTH_MAX_HEIGHT)
      );
      monthMarkers.push(ring(center, cy, theme));
    }
    monthLabels.push(
      el(
        'text',
        { x: center, y: MONTH_VALUE_BASELINE, class: 't-num', 'text-anchor': 'middle' },
        textNode(formatCompact(value))
      ),
      el('text', { x: center, y: MONTH_TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' }, textNode(letter))
    );
  });

  const eyebrows =
    el('text', { x: LEFT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('BY WEEKDAY')) +
    el('text', { x: RIGHT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('BY MONTH'));

  // The footer opens with the population both panels split, so the bars are
  // read as shares of a stated total rather than as free-floating counts.
  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatInt(rhythm.total))),
    textNode(' contributions · '),
    el('tspan', { class: 't-stat' }, textNode(`${Math.round(rhythm.activeDayRate * 100)}%`)),
    textNode(' active days'),
  ];
  if (rhythm.busiestDay !== undefined) {
    footerParts.push(
      textNode(' · busiest '),
      el('tspan', { class: 't-stat' }, textNode(formatDate(rhythm.busiestDay.date, true))),
      textNode(` (${rhythm.busiestDay.count})`)
    );
  }
  // Weekend share is the one footer fact worth pairing: it is the number the
  // reference ticks most often move, and a single figure hides that.
  footerParts.push(textNode(' · '), el('tspan', { class: 't-stat' }, textNode(pct(rhythm.weekendShare))));
  if (comparable) {
    footerParts.push(textNode(' → '), el('tspan', { class: 't-stat' }, textNode(pct(recent.weekendShare))));
  }
  footerParts.push(textNode(' on weekends'));
  const footer = el('text', { x: LEFT_X, y: FOOTER_BASELINE, class: 't-label' }, ...footerParts);

  const key = comparable ? trailingKey(theme, FOOTER_BASELINE) : '';

  const height = FOOTER_BASELINE + CARD_PADDING;

  return cardFrame(
    {
      theme,
      icon: ChartColumn,
      height,
      title: 'Activity rhythm',
      note: comparable
        ? 'all contribution types · share of all years vs trailing year'
        : 'all contribution types · all years',
      description:
        `Activity rhythm for ${data.login}: contributions by weekday and by month of year, ` +
        `busiest on ${WEEKDAY_LABELS[rhythm.peakWeekday] ?? 'Mon'} and in ${MONTH_NAMES[rhythm.peakMonth] ?? 'January'}.`,
      extraCss:
        `.hbar{opacity:0;animation:growX .55s cubic-bezier(.2,.7,.3,1) forwards}` +
        `.vbar{opacity:0;animation:grow .55s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el(
      'g',
      { class: 'fade' },
      eyebrows,
      key,
      ...weekdayTracks,
      ...monthTracks,
      ...weekdayLabels,
      ...monthLabels,
      footer
    ),
    ...weekdayBars,
    ...monthBars,
    // Markers last, so a ring stays on top of the bar it compares against.
    el('g', { class: 'fade' }, ...weekdayMarkers, ...monthMarkers)
  );
}
