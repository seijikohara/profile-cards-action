/**
 * Commit cadence card: a weekday × hour punch card over the trailing-year
 * commit sweep. Dot size and fill encode the quantile level of each cell, the
 * busiest cell is drawn in the accent color, and a footer line carries the
 * sweep's volume stats. Hours are the author's local clock (GitTimestamp keeps
 * the commit's UTC offset), so the card answers "when does this person commit"
 * on their own clock.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeCadence } from '../compute/cadence.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Vertical rhythm of the card, in absolute user-space coordinates.
const GRID_TOP = 66;
const ROW_H = 24;
const GRID_BOTTOM = GRID_TOP + ROW_H * WEEKDAY_LABELS.length;
const TICK_BASELINE = GRID_BOTTOM + 16;
const FOOTER_BASELINE = TICK_BASELINE + 27;

// Horizontal geometry: a label gutter, then 24 equal hour columns.
const GRID_LEFT = CARD_PADDING + 40;
const GRID_W = CARD_WIDTH - CARD_PADDING - GRID_LEFT;
const COL_W = GRID_W / 24;

/** Dot radius per level 0..4 — area grows with activity, small enough to keep the grid airy. */
const DOT_RADIUS = [1.6, 3.2, 4.6, 6, 7.4] as const;

/**
 * Compact magnitude for footer values, e.g. 45231 -> "45.2k". Extends rhythm's
 * format with a millions tier: line counts over a year of lockfile churn
 * realistically pass 1M.
 */
function compact(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value >= 1_000_000 ? value / 1_000_000 : value / 1000;
  const unit = value >= 1_000_000 ? 'm' : 'k';
  return `${scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10}${unit}`;
}

export function renderCadence(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const cadence = computeCadence(data.commits);

  // One group per hour column so the entry stagger costs 24 style attributes,
  // not 168.
  const columns: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const cx = GRID_LEFT + hour * COL_W + COL_W / 2;
    const dots: string[] = [];
    cadence.levels.forEach((row, weekday) => {
      const level = row[hour] ?? 0;
      const cy = GRID_TOP + weekday * ROW_H + ROW_H / 2;
      const isPeak = cadence.peak !== undefined && cadence.peak.weekday === weekday && cadence.peak.hour === hour;
      dots.push(
        el('circle', {
          cx,
          cy,
          r: DOT_RADIUS[level],
          fill: isPeak ? theme.accent : theme.contribRamp[level],
        })
      );
    });
    columns.push(el('g', { class: 'dot', style: `animation-delay:${hour * 14}ms` }, ...dots));
  }

  const weekdayLabels = WEEKDAY_LABELS.map((label, index) =>
    el(
      'text',
      { x: GRID_LEFT - 10, y: GRID_TOP + index * ROW_H + ROW_H / 2 + 4, class: 't-label', 'text-anchor': 'end' },
      textNode(label)
    )
  );

  const hourTicks: string[] = [];
  for (let hour = 0; hour < 24; hour += 2) {
    hourTicks.push(
      el(
        'text',
        { x: GRID_LEFT + hour * COL_W + COL_W / 2, y: TICK_BASELINE, class: 't-tick', 'text-anchor': 'middle' },
        textNode(String(hour))
      )
    );
  }

  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(compact(cadence.totalCommits))),
    textNode(' commits'),
  ];
  if (cadence.peak !== undefined) {
    const peakLabel = `${WEEKDAY_LABELS[cadence.peak.weekday] ?? ''} ${String(cadence.peak.hour).padStart(2, '0')}:00`;
    footerParts.push(textNode(' · peak '), el('tspan', { class: 't-stat' }, textNode(peakLabel)));
  }
  footerParts.push(
    textNode(' · '),
    el('tspan', { class: 't-stat' }, textNode(`+${compact(cadence.additions)}`)),
    textNode(' '),
    el('tspan', { class: 't-stat' }, textNode(`−${compact(cadence.deletions)}`)),
    textNode(' lines')
  );
  const footer = el('text', { x: CARD_PADDING, y: FOOTER_BASELINE, class: 't-label' }, ...footerParts);

  const height = FOOTER_BASELINE + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: 'Commit cadence',
      note: 'trailing 12 months · author local time',
      description: `Commit cadence for ${data.login}: commits by weekday and hour of day over the trailing year.`,
      extraCss: `.dot{opacity:0;animation:fade .45s ease forwards}.t-stat{font-weight:600;fill:${theme.fg}}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, ...weekdayLabels, ...hourTicks),
    ...columns,
    footer
  );
}
