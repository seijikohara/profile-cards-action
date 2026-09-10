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
 * Each bar also carries a reference tick at the trailing year's position in its
 * own panel, so the card answers "and has that changed?" without a second set
 * of bars. Both series are normalised against their own maximum: the comparison
 * is between shapes, not volumes, which is the only comparison an eleven-year
 * profile and a one-year window can honestly support.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRhythm } from '../compute/rhythm.js';
import type { ProfileData } from '../model.js';
import { horizontalBar, verticalBar } from '../svg/bars.js';
import { el, textNode } from '../svg/dsl.js';
import { formatCompact, measureMono } from '../svg/text.js';
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
const VALUE_GAP = 6;
const WEEKDAY_MAX_LEN = LEFT_X + LEFT_W - BAR_START_X - 40; // leaves room for the end value
const ROW_H = (BASELINE_Y - BAND_TOP) / WEEKDAY_LABELS.length;

// Month panel geometry.
const MONTH_BAND = RIGHT_W / MONTH_LETTERS.length;
const MONTH_BAR_W = 22;
const MONTH_VALUE_GAP = 6;

const MIN_BAR = 3; // keep a tiny non-zero value visible; zero renders nothing

// The trailing-year reference tick: foreground ink, never a second hue.
const TICK_OVERHANG = 3; // how far the tick stands proud of the bar it marks
const TICK_WIDTH = 2;

/**
 * The comparison needs two windows that are actually different. Below this many
 * days of history the trailing year IS most of the record, and the tick would
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
 * record; the tick is where the trailing year sits in its own panel.
 */
function trailingKey(theme: Theme, baseline: number): string {
  const right = CARD_WIDTH - CARD_PADDING;
  const tickCaption = 'trailing year';
  const barCaption = 'all years';
  const tickTextX = right;
  const tickMarkX = tickTextX - measureMono(tickCaption, 9.5) - 12;
  const barTextX = tickMarkX - 22;
  const barMarkX = barTextX - measureMono(barCaption, 9.5) - 16;
  return (
    el('rect', { x: barMarkX, y: baseline - 8, width: 12, height: 8, rx: 2, fill: theme.contribRamp[3] }) +
    el('text', { x: barTextX, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(barCaption)) +
    el('rect', { x: tickMarkX, y: baseline - 11, width: TICK_WIDTH, height: 14, fill: theme.fg }) +
    el('text', { x: tickTextX, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(tickCaption))
  );
}

/** Round a path/transform coordinate to 2 decimals — mirrors the dsl's num(). */
function coord(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function renderRhythm(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const rhythm = computeRhythm(data.lifetimeDays);
  const recent = computeRhythm(data.trailing.days);
  const comparable = data.lifetimeDays.length >= MIN_HISTORY_DAYS;
  const recentWeekdayMax = Math.max(0, ...recent.weekday);
  const recentMonthMax = Math.max(0, ...recent.month);

  // Weekday panel: seven horizontal bars, Mon..Sun top to bottom.
  const weekdayMax = Math.max(0, ...rhythm.weekday);
  const weekdayLabels: string[] = [];
  const weekdayValues: string[] = [];
  const weekdayBars: string[] = [];
  WEEKDAY_LABELS.forEach((label, index) => {
    const value = rhythm.weekday[index] ?? 0;
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    const scaled = weekdayMax === 0 ? 0 : (value / weekdayMax) * WEEKDAY_MAX_LEN;
    const length = value === 0 ? 0 : Math.max(MIN_BAR, scaled);

    weekdayLabels.push(
      el('text', { x: BAR_START_X - 8, y: rowCenter + 4, class: 't-label', 'text-anchor': 'end' }, textNode(label))
    );
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
            rowCenter - WEEKDAY_BAR_H / 2,
            length,
            WEEKDAY_BAR_H,
            barFill(theme, value, weekdayMax)
          )
        )
      );
    }
    if (comparable && recentWeekdayMax > 0) {
      const share = (recent.weekday[index] ?? 0) / recentWeekdayMax;
      weekdayLabels.push(
        el('rect', {
          x: BAR_START_X + share * WEEKDAY_MAX_LEN - TICK_WIDTH / 2,
          y: rowCenter - WEEKDAY_BAR_H / 2 - TICK_OVERHANG,
          width: TICK_WIDTH,
          height: WEEKDAY_BAR_H + TICK_OVERHANG * 2,
          fill: theme.fg,
        })
      );
    }
    weekdayValues.push(
      el(
        'text',
        { x: BAR_START_X + length + VALUE_GAP, y: rowCenter + 3.3, class: 't-tick' },
        textNode(formatCompact(value))
      )
    );
  });

  // Month panel: twelve vertical bars, Jan..Dec on the shared baseline. Every
  // bar carries its value, matching the weekday panel — labelling only the peak
  // made the two panels answer the same question in two different ways.
  const monthMax = Math.max(0, ...rhythm.month);
  const monthBars: string[] = [];
  const monthTicks: string[] = [];
  MONTH_LETTERS.forEach((letter, index) => {
    const value = rhythm.month[index] ?? 0;
    const center = RIGHT_X + index * MONTH_BAND + MONTH_BAND / 2;
    const scaled = monthMax === 0 ? 0 : (value / monthMax) * MONTH_MAX_HEIGHT;
    const height = value === 0 ? 0 : Math.max(MIN_BAR, scaled);

    if (height > 0) {
      monthBars.push(
        el(
          'g',
          {
            class: 'vbar',
            style: `animation-delay:${index * 40}ms;transform-origin:${coord(center)}px ${coord(BASELINE_Y)}px`,
          },
          verticalBar(center - MONTH_BAR_W / 2, BASELINE_Y, MONTH_BAR_W, height, barFill(theme, value, monthMax))
        )
      );
      monthTicks.push(
        el(
          'text',
          { x: center, y: BASELINE_Y - height - MONTH_VALUE_GAP, class: 't-tick', 'text-anchor': 'middle' },
          textNode(formatCompact(value))
        )
      );
    }
    if (comparable && recentMonthMax > 0) {
      const share = (recent.month[index] ?? 0) / recentMonthMax;
      monthTicks.push(
        el('rect', {
          x: center - MONTH_BAR_W / 2 - TICK_OVERHANG,
          y: BASELINE_Y - share * MONTH_MAX_HEIGHT - TICK_WIDTH / 2,
          width: MONTH_BAR_W + TICK_OVERHANG * 2,
          height: TICK_WIDTH,
          fill: theme.fg,
        })
      );
    }
    monthTicks.push(
      el('text', { x: center, y: MONTH_TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' }, textNode(letter))
    );
  });

  const eyebrows =
    el('text', { x: LEFT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('BY WEEKDAY')) +
    el('text', { x: RIGHT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('BY MONTH'));

  // A quiet y-axis for the weekday bars and a baseline for the month bars.
  const weekdayAxis = el('line', {
    x1: BAR_START_X - 0.5,
    y1: BAND_TOP,
    x2: BAR_START_X - 0.5,
    y2: BASELINE_Y,
    stroke: theme.border,
    'stroke-width': 1,
  });
  const monthBaseline = el('line', {
    x1: RIGHT_X,
    y1: BASELINE_Y + 0.5,
    x2: RIGHT_X + RIGHT_W,
    y2: BASELINE_Y + 0.5,
    stroke: theme.border,
    'stroke-width': 1,
  });

  // The footer opens with the population both panels split, so the bars are
  // read as shares of a stated total rather than as free-floating counts.
  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatCompact(rhythm.total))),
    textNode(' contributions · '),
    el('tspan', { class: 't-stat' }, textNode(`${Math.round(rhythm.activeDayRate * 100)}%`)),
    textNode(' active days'),
  ];
  if (rhythm.busiestDay !== undefined) {
    footerParts.push(
      textNode(' · busiest '),
      el('tspan', { class: 't-stat' }, textNode(rhythm.busiestDay.date)),
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
      height,
      title: 'Activity rhythm',
      note: comparable ? 'all contribution types · all years vs trailing year' : 'all contribution types · all years',
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
      weekdayAxis,
      monthBaseline,
      ...weekdayLabels,
      ...weekdayValues,
      ...monthTicks,
      footer
    ),
    ...weekdayBars,
    ...monthBars
  );
}
