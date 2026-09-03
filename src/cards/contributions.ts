/**
 * Contributions card: streak tiles plus the trailing-12-month contribution
 * calendar as an isometric 3D graph (flat axonometric projection, pure static
 * polygons).
 *
 * Color carries the API's exact quartile encoding; column height reinforces it
 * on a square-root scale, chosen so one spike day cannot flatten every typical
 * day to invisibility. Height is redundant decoration over the honest color
 * channel, never the primary encoding.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { range } from '../iter.js';
import type { DayContribution, ProfileData, Streaks } from '../model.js';
import { el, num, textNode } from '../svg/dsl.js';
import { formatDate, formatDateRange, formatInt, formatUtcTimestamp } from '../svg/text.js';
import { shade, type Theme } from '../theme.js';
import { cardFrame, tileRow, type TileSpec } from './frame.js';
import { rampLegend } from './legend.js';

// Axonometric tile: 24px wide, 8px tall footprint (3:1 — flatter than true
// isometric, which keeps the 53-week ribbon from eating vertical space).
const HW = 12;
const HH = 4;
const MAX_COLUMN = 40;
const MIN_COLUMN = 3;

interface Point {
  readonly x: number;
  readonly y: number;
}

function polygon(points: readonly Point[], fill: string): string {
  const rendered = points.map((point) => `${num(point.x)},${num(point.y)}`).join(' ');
  return el('polygon', { points: rendered, fill });
}

/** One day column: flat diamond for zero, three shaded faces otherwise. */
function dayColumn(x: number, y: number, height: number, topFill: string, leftFill: string, rightFill: string): string {
  const top: Point[] = [
    { x, y: y - height },
    { x: x + HW, y: y + HH - height },
    { x, y: y + HH * 2 - height },
    { x: x - HW, y: y + HH - height },
  ];
  if (height === 0) return polygon(top, topFill);
  const left = polygon(
    [
      { x: x - HW, y: y + HH - height },
      { x, y: y + HH * 2 - height },
      { x, y: y + HH * 2 },
      { x: x - HW, y: y + HH },
    ],
    leftFill
  );
  const right = polygon(
    [
      { x, y: y + HH * 2 - height },
      { x: x + HW, y: y + HH - height },
      { x: x + HW, y: y + HH },
      { x, y: y + HH * 2 },
    ],
    rightFill
  );
  return polygon(top, topFill) + left + right;
}

/** Weeks-of-days matrix from the flat day series (calendar order, 7 rows). */
export function toWeeks(days: readonly DayContribution[]): readonly (readonly DayContribution[])[] {
  // The API returns whole weeks except possibly the current partial one.
  return range(Math.ceil(days.length / 7)).map((week) => days.slice(week * 7, week * 7 + 7));
}

export function renderContributions(data: ProfileData, streaks: Streaks, theme: Theme, fontFaceCss: string): string {
  const weeks = toWeeks(data.trailing.days);
  const weekCount = weeks.length;
  const maxCount = Math.max(1, ...data.trailing.days.map((day) => day.count));

  // Precomputed face shades per contribution level (no CSS filters in SVG-in-img).
  const faces = theme.contribRamp.map((color) => ({
    top: color,
    left: shade(color, 0.18),
    right: shade(color, 0.38),
  }));

  const trailingDayCount = data.trailing.days.length;
  const peakDay = Math.max(0, ...data.trailing.days.map((day) => day.count));
  const tiles: TileSpec[] = [
    {
      label: 'Current streak',
      value: formatInt(streaks.current),
      unit: streaks.current === 1 ? 'day' : 'days',
      sub: streaks.currentRange
        ? formatDateRange(streaks.currentRange.start, streaks.currentRange.end)
        : 'No active streak',
    },
    {
      label: 'Longest streak',
      value: formatInt(streaks.longest),
      unit: streaks.longest === 1 ? 'day' : 'days',
      sub: streaks.longestRange
        ? formatDateRange(streaks.longestRange.start, streaks.longestRange.end)
        : 'No contributions yet',
    },
    {
      label: 'Contributions (past 12 months)',
      value: formatInt(data.trailing.total),
      // The note already names the window; the caption carries rates instead.
      sub:
        trailingDayCount === 0
          ? undefined
          : `Avg ${(data.trailing.total / trailingDayCount).toFixed(1)} / day · peak ${formatInt(peakDay)}`,
    },
  ];
  const tileTop = 60;
  const { svg: tilesSvg, height: tileHeight } = tileRow(theme, tiles, tileTop);

  // Grid framing.
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const minPx = -(6 * HW) - HW;
  const maxPx = (weekCount - 1) * HW + HW;
  const span = maxPx - minPx;
  const originX = CARD_PADDING + (inner - span) / 2 - minPx;
  const graphTop = tileTop + tileHeight + 18;
  const originY = graphTop + MAX_COLUMN;
  const groundBottom = originY + (weekCount - 1 + 6) * HH + HH * 2;

  // Month ticks along the front-left edge: label each week that contains the
  // first day of a month, at that week's front (Saturday) corner.
  const monthTicks = weeks.flatMap((week, w) => {
    const firstOfMonth = week.find((day) => day.date.endsWith('-01'));
    if (!firstOfMonth) return [];
    const label = formatDate(firstOfMonth.date, false).split(' ')[0] ?? '';
    return [
      el(
        'text',
        {
          x: originX + (w - 6) * HW - HW - 6,
          y: originY + (w + 6) * HH + HH * 2 + 4,
          class: 't-tick',
          'text-anchor': 'end',
        },
        textNode(label)
      ),
    ];
  });

  const weekGroups = weeks.map((week, w) => {
    const columns = week.map((day, d) => {
      const face = faces[day.level] ?? faces[0];
      if (face === undefined) throw new Error('empty contribution ramp');
      // sqrt keeps typical days visible when one spike day dominates the
      // window; the exact magnitude encoding stays with the quartile color.
      const height = day.count === 0 ? 0 : MIN_COLUMN + Math.sqrt(day.count / maxCount) * (MAX_COLUMN - MIN_COLUMN);
      return dayColumn(originX + (w - d) * HW, originY + (w + d) * HH, height, face.top, face.left, face.right);
    });
    return el('g', { class: 'iso', style: `animation-delay:${w * 12}ms` }, ...columns);
  });

  // Legend (bottom-left) and refresh caption (bottom-right).
  const legendY = groundBottom + 22;
  const legend = rampLegend(theme, CARD_PADDING, legendY);
  const caption = el(
    'text',
    { x: CARD_WIDTH - CARD_PADDING, y: legendY, class: 't-mono', 'text-anchor': 'end' },
    textNode(`REFRESHED ${formatUtcTimestamp(data.generatedAt)}`)
  );

  const height = legendY + CARD_PADDING - 8;

  return cardFrame(
    {
      theme,
      height,
      title: 'Contributions',
      note: 'past 12 months · streaks over all years',
      description: `Contribution activity for ${data.login}: ${formatInt(data.trailing.total)} contributions in the past 12 months, current streak ${formatInt(streaks.current)} days, longest streak ${formatInt(streaks.longest)} days.`,
      extraCss: `.iso{opacity:0;animation:rise .5s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, tilesSvg),
    ...weekGroups,
    el('g', { class: 'fade' }, ...monthTicks),
    legend,
    caption
  );
}
