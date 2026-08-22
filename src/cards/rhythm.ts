/**
 * Activity rhythm card: two small-multiple panels derived from the lifetime
 * daily series — a weekday profile (horizontal bars, Mon..Sun) and a
 * month-of-year profile (vertical bars, Jan..Dec) sharing one baseline. The
 * peak bar in each panel is drawn in the accent color; the rest use a calmer
 * contribution green so a single reading — "when is this person active" —
 * stays legible at a glance.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRhythm } from '../compute/rhythm.js';
import type { ProfileData } from '../model.js';
import { horizontalBar, verticalBar } from '../svg/bars.js';
import { el, textNode } from '../svg/dsl.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

// Vertical rhythm of the card, in absolute user-space coordinates.
const EYEBROW_BASELINE = 64;
const BAND_TOP = 84; // top of the tallest month bar / first weekday row
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

const MIN_BAR = 3; // keep a tiny non-zero value visible; zero renders nothing

/** Round a path/transform coordinate to 2 decimals — mirrors the dsl's num(). */
function coord(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Compact magnitude for the bar-end value, e.g. 2345 -> "2.3k". */
function compact(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

export function renderRhythm(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const rhythm = computeRhythm(data.lifetimeDays);
  const calmFill = theme.contribRamp[2];

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
    const fill = index === rhythm.peakWeekday && value > 0 ? theme.accent : calmFill;

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
          horizontalBar(BAR_START_X, rowCenter - WEEKDAY_BAR_H / 2, length, WEEKDAY_BAR_H, fill)
        )
      );
    }
    weekdayValues.push(
      el('text', { x: BAR_START_X + length + VALUE_GAP, y: rowCenter + 3.3, class: 't-tick' }, textNode(compact(value)))
    );
  });

  // Month panel: twelve vertical bars, Jan..Dec on the shared baseline.
  const monthMax = Math.max(0, ...rhythm.month);
  const monthBars: string[] = [];
  const monthTicks: string[] = [];
  MONTH_LETTERS.forEach((letter, index) => {
    const value = rhythm.month[index] ?? 0;
    const center = RIGHT_X + index * MONTH_BAND + MONTH_BAND / 2;
    const scaled = monthMax === 0 ? 0 : (value / monthMax) * MONTH_MAX_HEIGHT;
    const height = value === 0 ? 0 : Math.max(MIN_BAR, scaled);
    const fill = index === rhythm.peakMonth && value > 0 ? theme.accent : calmFill;

    if (height > 0) {
      monthBars.push(
        el(
          'g',
          {
            class: 'vbar',
            style: `animation-delay:${index * 40}ms;transform-origin:${coord(center)}px ${coord(BASELINE_Y)}px`,
          },
          verticalBar(center - MONTH_BAR_W / 2, BASELINE_Y, MONTH_BAR_W, height, fill)
        )
      );
    }
    monthTicks.push(
      el('text', { x: center, y: MONTH_TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' }, textNode(letter))
    );
  });

  const eyebrows =
    el('text', { x: LEFT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('WEEKDAY')) +
    el('text', { x: RIGHT_X, y: EYEBROW_BASELINE, class: 't-mono' }, textNode('MONTH'));

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

  const footerParts: string[] = [
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
  footerParts.push(
    textNode(' · '),
    el('tspan', { class: 't-stat' }, textNode(`${Math.round(rhythm.weekendShare * 100)}%`)),
    textNode(' on weekends')
  );
  const footer = el('text', { x: LEFT_X, y: FOOTER_BASELINE, class: 't-label' }, ...footerParts);

  const height = FOOTER_BASELINE + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: 'Activity rhythm',
      note: 'by weekday · by month',
      description: `Activity rhythm for ${data.login}: contributions by weekday and by month of year.`,
      extraCss:
        `.hbar{opacity:0;animation:growX .55s cubic-bezier(.2,.7,.3,1) forwards}` +
        `.vbar{opacity:0;animation:grow .55s cubic-bezier(.2,.7,.3,1) forwards}` +
        `.t-stat{font-weight:600;fill:${theme.fg}}`,
      fontFaceCss,
    },
    el(
      'g',
      { class: 'fade' },
      eyebrows,
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
