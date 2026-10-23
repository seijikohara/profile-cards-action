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

import { CalendarDays, CalendarRange, Flame, Trophy } from 'lucide';
import type { LegendStyle } from '../cards.js';
import { CARD_PADDING, CARD_WIDTH, DEFAULT_LEGEND } from '../config.js';
import { calendarThresholds } from '../compute/thresholds.js';
import { range } from '../iter.js';
import type { DayContribution, ProfileData, Streaks } from '../model.js';
import { el, num, textNode } from '../svg/dsl.js';
import { GROUND } from '../svg/effects.js';
import { formatDate, formatDateRange, formatInt, formatUtcTimestamp } from '../svg/text.js';
import { shiftLightness, type Theme } from '../theme.js';
import { cardFrame, tileRow, type TileSpec } from './frame.js';
import { privacyNote, rampLegend, RAMP_SCALE_ROW } from './legend.js';

// Axonometric tile: 24px wide, 8px tall footprint (3:1 — flatter than true
// isometric, which keeps the 53-week ribbon from eating vertical space).
const HW = 12;
const HH = 4;
const MAX_COLUMN = 54;
const MIN_COLUMN = 4;
const GROUND_DROP = 7;
const CELL_GAP = 1.2; // inset of each day's footprint, in px along the iso x-axis
const SLAB = 8; // thickness of the floor the calendar stands on
const CALLOUT_ROOM = 22; // height the peak label and its leader need above the column
const CALLOUT_LEADER = 12;

interface Point {
  readonly x: number;
  readonly y: number;
}

function polygon(points: readonly Point[], fill: string): string {
  const rendered = points.map((point) => `${num(point.x)},${num(point.y)}`).join(' ');
  return el('polygon', { points: rendered, fill });
}

/** The three visible faces of a day column, lit from the back left. */
interface Faces {
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

/**
 * One day column on the cell whose back corner is (x, y): a flat diamond for
 * zero, three shaded faces otherwise. The footprint is inset by CELL_GAP so
 * neighbouring days stand as separate blocks with a sliver of floor between
 * them, the way the flat calendar separates its squares.
 */
function dayColumn(x: number, y: number, height: number, faces: Faces): string {
  const hw = HW - CELL_GAP;
  const hh = (HH * hw) / HW;
  const cy = y + HH;
  const top: Point[] = [
    { x, y: cy - hh - height },
    { x: x + hw, y: cy - height },
    { x, y: cy + hh - height },
    { x: x - hw, y: cy - height },
  ];
  if (height === 0) return polygon(top, faces.top);
  const left = polygon(
    [
      { x: x - hw, y: cy - height },
      { x, y: cy + hh - height },
      { x, y: cy + hh },
      { x: x - hw, y: cy },
    ],
    faces.left
  );
  const right = polygon(
    [
      { x, y: cy + hh - height },
      { x: x + hw, y: cy - height },
      { x: x + hw, y: cy },
      { x, y: cy + hh },
    ],
    faces.right
  );
  return polygon(top, faces.top) + left + right;
}

/** Weeks-of-days matrix from the flat day series (calendar order, 7 rows). */
export function toWeeks(days: readonly DayContribution[]): readonly (readonly DayContribution[])[] {
  // The API returns whole weeks except possibly the current partial one.
  return range(Math.ceil(days.length / 7)).map((week) => days.slice(week * 7, week * 7 + 7));
}

export function renderContributions(
  data: ProfileData,
  streaks: Streaks,
  theme: Theme,
  fontFaceCss: string,
  legendStyle: LegendStyle = DEFAULT_LEGEND
): string {
  const weeks = toWeeks(data.trailing.days);
  const weekCount = weeks.length;
  const maxCount = Math.max(1, ...data.trailing.days.map((day) => day.count));

  // Precomputed face shades per contribution level. Darkening along OKLCH
  // lightness keeps each side the same hue as its top; mixing toward black
  // turned the right faces of the lighter steps into grey.
  // The dark theme shades more gently: its level-1 green is already close to
  // the canvas, and a deep right face would sink below the slab and erase the
  // block's edge.
  const shading = theme.id === 'dark' ? { left: -0.04, right: -0.1 } : { left: -0.08, right: -0.18 };
  const faces: readonly Faces[] = theme.contribRamp.map((color) => ({
    top: color,
    left: shiftLightness(color, shading.left),
    right: shiftLightness(color, shading.right),
  }));

  const trailingDayCount = data.trailing.days.length;
  const peakDay = Math.max(0, ...data.trailing.days.map((day) => day.count));
  const tiles: TileSpec[] = [
    {
      label: 'Current streak',
      icon: Flame,
      value: formatInt(streaks.current),
      unit: streaks.current === 1 ? 'day' : 'days',
      sub: streaks.currentRange
        ? formatDateRange(streaks.currentRange.start, streaks.currentRange.end)
        : 'No active streak',
    },
    {
      label: 'Longest streak',
      icon: Trophy,
      value: formatInt(streaks.longest),
      unit: streaks.longest === 1 ? 'day' : 'days',
      sub: streaks.longestRange
        ? formatDateRange(streaks.longestRange.start, streaks.longestRange.end)
        : 'No contributions yet',
    },
    {
      label: 'Contributions (past 12 months)',
      icon: CalendarRange,
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
  // The tallest column rises MAX_COLUMN above its cell, and its label needs
  // CALLOUT_ROOM more; a peak deep in the grid already has that room.
  const peak = weeks
    .flatMap((week, w) => week.map((day, d) => ({ day, w, d })))
    .reduce<{ readonly day: DayContribution; readonly w: number; readonly d: number } | undefined>(
      (best, entry) => (best === undefined || entry.day.count > best.day.count ? entry : best),
      undefined
    );
  const calloutRoom = peak === undefined ? 0 : Math.max(0, CALLOUT_ROOM - (peak.w + peak.d) * HH);
  const graphTop = tileTop + tileHeight + 18 + calloutRoom;
  const originY = graphTop + MAX_COLUMN;
  const groundBottom = originY + (weekCount - 1 + 6) * HH + HH * 2 + SLAB;

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
          x: originX + (w - 6) * HW - HW - 8,
          y: originY + (w + 6) * HH + HH * 2 + 4 + SLAB,
          class: 't-tick',
          'text-anchor': 'end',
        },
        textNode(label)
      ),
    ];
  });

  // The floor is a thin slab: a top the day cells sit on, two front faces
  // that give it thickness, and beneath it a contact shadow on white or a
  // faint glow of the palette ink on the dark canvas. The calendar then reads
  // as an object resting on the card rather than a drawing printed on it.
  const lastWeek = Math.max(0, weekCount - 1);
  const back = { x: originX, y: originY };
  const right = { x: originX + lastWeek * HW + HW, y: originY + lastWeek * HH + HH };
  const front = { x: originX + (lastWeek - 6) * HW, y: originY + (lastWeek + 6) * HH + HH * 2 };
  const left = { x: originX - 7 * HW, y: originY + 6 * HH + HH };
  const down = (point: Point): Point => ({ x: point.x, y: point.y + SLAB });
  const dark = theme.id === 'dark';
  const slabTop = dark ? shiftLightness(theme.bg, 0.035) : theme.bg;
  const groundShadow = el('polygon', {
    points: [back, right, front, left].map((point) => `${num(point.x)},${num(point.y + SLAB + GROUND_DROP)}`).join(' '),
    fill: dark ? theme.ink : '#1f2328',
    'fill-opacity': dark ? 0.16 : 0.22,
    filter: GROUND,
  });
  const slab =
    polygon([back, right, front, left], slabTop) +
    polygon([left, front, down(front), down(left)], shiftLightness(slabTop, dark ? 0.06 : -0.05)) +
    polygon([front, right, down(right), down(front)], shiftLightness(slabTop, dark ? 0.03 : -0.1));

  // Weekday names along the right-hand edge, matching the flat calendar's
  // Mon / Wed / Fri, so a row can be read without counting.
  const weekdayTicks = [
    { d: 1, label: 'Mon' },
    { d: 3, label: 'Wed' },
    { d: 5, label: 'Fri' },
  ].map(({ d, label }) =>
    el(
      'text',
      {
        x: originX + (lastWeek - d) * HW + HW + 6,
        y: originY + (lastWeek + d) * HH + HH + 3 + SLAB / 2,
        class: 't-tick',
      },
      textNode(label)
    )
  );

  // Callout on the busiest day: a hairline from its top to a label, so the
  // one number the height scale compresses most is stated outright.
  const callout = (() => {
    if (peak === undefined || peak.day.count === 0) return '';
    const x = originX + (peak.w - peak.d) * HW;
    const topY = originY + (peak.w + peak.d) * HH + HH - (HH * (HW - CELL_GAP)) / HW - MAX_COLUMN;
    const label = `${formatInt(peak.day.count)} · ${formatDate(peak.day.date, false).toUpperCase()}`;
    const half = (label.length + 5) * 3.2;
    const labelX = Math.min(CARD_WIDTH - CARD_PADDING - half, Math.max(CARD_PADDING + half, x));
    return (
      el('line', { x1: x, y1: topY - 2, x2: x, y2: topY - CALLOUT_LEADER, stroke: theme.fgMuted, 'stroke-width': 1 }) +
      el('circle', { cx: x, cy: topY - 1, r: 1.8, fill: theme.fg }) +
      el(
        'text',
        { x: labelX, y: topY - CALLOUT_LEADER - 4, class: 't-mono', 'text-anchor': 'middle' },
        textNode('PEAK '),
        el('tspan', { fill: theme.fg }, textNode(label))
      )
    );
  })();

  const weekGroups = weeks.map((week, w) => {
    const columns = week.map((day, d) => {
      const face = faces[day.level] ?? faces[0];
      if (face === undefined) throw new Error('empty contribution ramp');
      // sqrt keeps typical days visible when one spike day dominates the
      // window; the exact magnitude encoding stays with the quartile color.
      const height = day.count === 0 ? 0 : MIN_COLUMN + Math.sqrt(day.count / maxCount) * (MAX_COLUMN - MIN_COLUMN);
      return dayColumn(originX + (w - d) * HW, originY + (w + d) * HH, height, face);
    });
    return el('g', { class: 'iso', style: `animation-delay:${w * 12}ms` }, ...columns);
  });

  // Legend (bottom-left) and refresh caption (bottom-right).
  const legendY = groundBottom + 22;
  // The isometric columns are leveled by the API's own daily quartiles, so the
  // scale counts contributions per day.
  const scale =
    legendStyle === 'scale' ? { thresholds: calendarThresholds(data.trailing.days), unit: 'per day' } : undefined;
  const legend = rampLegend(theme, CARD_PADDING, legendY, scale === undefined ? {} : { scale });
  const caption = el(
    'text',
    { x: CARD_WIDTH - CARD_PADDING, y: legendY, class: 't-mono', 'text-anchor': 'end' },
    textNode(`REFRESHED ${formatUtcTimestamp(data.generatedAt)}`)
  );

  const height = legendY + (scale === undefined ? 0 : RAMP_SCALE_ROW) + CARD_PADDING - 8;

  return cardFrame(
    {
      theme,
      icon: CalendarDays,
      height,
      title: 'Contributions',
      note: `past 12 months · streaks over all years · ${privacyNote(data.trailing.includesPrivate)}`,
      description: `Contribution activity for ${data.login}: ${formatInt(data.trailing.total)} contributions in the past 12 months, current streak ${formatInt(streaks.current)} days, longest streak ${formatInt(streaks.longest)} days.`,
      extraCss: `.iso{opacity:0;animation:rise .5s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, tilesSvg),
    el('g', { class: 'fade' }, groundShadow, slab),
    ...weekGroups,
    el('g', { class: 'fade' }, ...monthTicks, ...weekdayTicks, callout),
    legend,
    caption
  );
}
