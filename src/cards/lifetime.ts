/**
 * Lifetime heatmap card: a "wall of years" where each row is one calendar year
 * and each cell is one week, colored by the API's quartile activity level.
 *
 * The card trades the trailing-12-month graph's day resolution for range — every
 * year since the first contribution in a single view. Week cells reuse the honest
 * contribRamp encoding, so a reader compares intensity across a decade at a glance
 * with no lookup beyond the ramp itself. The reveal sweeps left to right, one
 * animation per week column, which reads as time advancing through each year.
 */

import { computeLifetime } from '../compute/lifetime.js';
import { range } from '../iter.js';
import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import { formatInt } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { rampLegend } from './legend.js';

/** Top-axis month labels, placed by week ≈ month * COLS / 12. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// Grid geometry. COLS is the design target (a full 53-week year); a shorter year
// leaves its right edge blank, so every card sizes its cells identically.
const COLS = 53;
const GUTTER = 34; // left column holding the year labels
const TOTAL_GUTTER = 50; // right column holding the per-year totals
const CELL_H = 10;
const CELL_HGAP = 3;
const CELL_VGAP = 3;
const ROW_PITCH = CELL_H + CELL_VGAP;
const CELL_RADIUS = 2;

// Vertical bands, summed into the card height below.
const TITLE_AREA = 54; // title + note baseline zone
const MONTH_ROW = 14; // month-tick labels above the grid
const LEGEND_ROW = 26; // "Less" … swatches … "More"

// Left-to-right reveal: delay ∝ column index, capped so the full sweep stays
// within SWEEP_MS regardless of how many weeks a year spans.
const COL_STEP_MS = 16;
const SWEEP_MS = 900;

export function renderLifetime(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const life = computeLifetime(data.lifetimeDays);
  const rows = life.years.length;

  // Defensive clamp: contribRamp is a 5-tuple, so the index must stay in 0..4
  // even if a level ever arrived out of range.
  const rampColor = (level: number): string => {
    const index = level < 1 ? 0 : level > 4 ? 4 : level;
    return theme.contribRamp[index] ?? theme.contribRamp[0];
  };

  // Horizontal frame: fixed gutter, then 53 week columns filling the inner width.
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const gridLeft = CARD_PADDING + GUTTER;
  const gridWidth = inner - GUTTER - TOTAL_GUTTER;
  const colPitch = gridWidth / COLS;
  const cellW = colPitch - CELL_HGAP;

  // Vertical frame: one row per year, height summed from the named bands.
  const gridTop = TITLE_AREA + MONTH_ROW;
  const gridBottom = gridTop + rows * ROW_PITCH;
  const height = gridBottom + LEGEND_ROW + CARD_PADDING;

  // Draw column-major so each week column is one animated group; a year shorter
  // than the widest simply contributes no cell past its last week.
  const maxCols = Math.min(COLS, Math.max(0, ...life.years.map((year) => year.weeks.length)));
  const step = Math.min(COL_STEP_MS, SWEEP_MS / Math.max(1, maxCols - 1));

  const columns = range(maxCols).map((c) => {
    const cells = life.years.flatMap((year, r) => {
      const level = year.weeks[c];
      return level === undefined
        ? []
        : [
            el('rect', {
              x: gridLeft + c * colPitch,
              y: gridTop + r * ROW_PITCH,
              width: cellW,
              height: CELL_H,
              rx: CELL_RADIUS,
              fill: rampColor(level),
            }),
          ];
    });
    return el('g', { class: 'wk', style: `animation-delay:${Math.round(c * step)}ms` }, ...cells);
  });

  // Month ticks straddle the columns where each month roughly begins.
  const monthTicks = MONTHS.map((label, month) =>
    el(
      'text',
      {
        x: gridLeft + ((month * COLS) / 12) * colPitch + cellW / 2,
        y: gridTop - 5,
        class: 't-tick',
        'text-anchor': 'middle',
      },
      textNode(label)
    )
  );

  // Year labels sit in the gutter, right-aligned and vertically centered on the row.
  const yearLabels = life.years.map((year, r) =>
    el(
      'text',
      {
        x: gridLeft - 8,
        y: gridTop + r * ROW_PITCH + CELL_H / 2 + 3.3,
        class: 't-tick',
        'text-anchor': 'end',
      },
      textNode(String(year.year))
    )
  );

  // Per-year totals close each row on the right — the wall's only numbers.
  const yearTotals = life.years.map((year, r) =>
    el(
      'text',
      {
        x: CARD_PADDING + inner,
        y: gridTop + r * ROW_PITCH + CELL_H / 2 + 3.3,
        class: 't-tick',
        'text-anchor': 'end',
      },
      textNode(formatInt(year.total))
    )
  );

  // Legend: "Less", the five ramp swatches, then "More" — no arrow glyph. The
  // swatches copy the wall's own cell, so the key and the data share a shape.
  const legendY = gridBottom + 17;
  const legend = rampLegend(theme, CARD_PADDING, legendY, {
    pitch: CELL_H + 4,
    swatch: (color, _level, cx, cy) =>
      el('rect', {
        x: cx - CELL_H / 2,
        y: cy - CELL_H / 2,
        width: CELL_H,
        height: CELL_H,
        rx: CELL_RADIUS,
        fill: color,
      }),
  });

  const firstYear = life.years[0]?.year;
  const note = firstYear === undefined ? 'no activity yet · by week' : `${firstYear}–present · by week`;
  const description =
    firstYear === undefined
      ? `Contribution history for ${data.login}: no activity yet.`
      : `Contribution history for ${data.login}, ${firstYear} to present, one row per year.`;

  return cardFrame(
    {
      theme,
      height,
      title: 'Contribution history',
      note,
      description,
      extraCss: `.wk{opacity:0;animation:fade .5s ease forwards}`,
      fontFaceCss,
    },
    ...columns,
    el('g', { class: 'fade' }, ...monthTicks, ...yearLabels, ...yearTotals, legend)
  );
}
