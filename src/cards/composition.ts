/**
 * Composition card: one stacked bar per contribution year, partitioned by type
 * (commits, pull requests, issues, reviews) plus private contributions.
 *
 * Bar height encodes the year's total activity against the peak year; the stack
 * order and color carry the type breakdown. `sum` from computeComposition is the
 * scale, never `year.total`: the calendar total counts active days while the
 * typed counts count events, so the two diverge and only the segment sum agrees
 * with the drawn rectangles.
 */

import { CARD_PADDING, CARD_RADIUS, CARD_WIDTH } from '../config.js';
import { computeComposition } from '../compute/composition.js';
import type { ProfileData } from '../model.js';
import { el, num, textNode } from '../svg/dsl.js';
import { formatCompact, measureSans } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';

const MAX_BAR_HEIGHT = 110;
const BAR_WIDTH = 30;

// Stack + legend order, paired with the seriesRamp index. Literal indices keep
// tuple access non-optional under noUncheckedIndexedAccess.
const SERIES = [
  { label: 'Commits', index: 0 },
  { label: 'Issues', index: 1 },
  { label: 'Pull requests', index: 2 },
  { label: 'Reviews', index: 3 },
  { label: 'Private', index: 4 },
] as const;

/** Rect with only its top two corners rounded — the cap of a stacked bar. */
function barCap(x: number, top: number, width: number, height: number, radius: number, fill: string): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return el('rect', { x, y: top, width, height, fill });
  const bottom = top + height;
  const right = x + width;
  const d =
    `M${num(x)} ${num(bottom)}` +
    `V${num(top + r)}` +
    `Q${num(x)} ${num(top)} ${num(x + r)} ${num(top)}` +
    `H${num(right - r)}` +
    `Q${num(right)} ${num(top)} ${num(right)} ${num(top + r)}` +
    `V${num(bottom)}Z`;
  return el('path', { d, fill });
}

export function renderComposition(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const { years, maxSum, privateShare, typeTotals } = computeComposition(data.years);

  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const band = inner / Math.max(1, years.length);

  // Vertical rhythm: title zone, eyebrow gap, bar band, tick row, legend row.
  const chartTop = 72;
  const baseline = chartTop + MAX_BAR_HEIGHT; // 182
  const tickY = baseline + 17;
  const legendY = tickY + 30;
  const height = legendY + CARD_PADDING - 5;

  // Grow the bars from the baseline, staggered so the whole sweep lands ~0.9s.
  const motionDuration = 0.42;
  const startSpan = 480;
  const step = years.length > 1 ? startSpan / (years.length - 1) : 0;

  const bars = years.map((year, i) => {
    const cx = CARD_PADDING + i * band + band / 2;
    const barWidth = Math.max(4, Math.min(BAR_WIDTH, band - 8));
    const x = cx - barWidth / 2;

    const segments = SERIES.map((series) => ({
      color: theme.seriesRamp[series.index],
      h: maxSum === 0 ? 0 : (year.segments[series.index] / maxSum) * MAX_BAR_HEIGHT,
    }));
    // Topmost drawn segment: the highest-index segment with any height.
    const topIndex = segments.reduce((top, segment, k) => (segment.h > 0 ? k : top), -1);

    let cursor = baseline;
    const rects = segments.map((segment, k) => {
      if (segment.h <= 0) return '';
      const top = cursor - segment.h;
      cursor = top;
      return k === topIndex
        ? barCap(x, top, barWidth, segment.h, CARD_RADIUS, segment.color)
        : el('rect', { x, y: top, width: barWidth, height: segment.h, fill: segment.color });
    });

    return el(
      'g',
      {
        class: 'bar',
        style: `animation-delay:${Math.round(step * i)}ms;transform-origin:${num(cx)}px ${num(baseline)}px`,
      },
      ...rects
    );
  });

  const ticks = years.map((year, i) => {
    const cx = CARD_PADDING + i * band + band / 2;
    return el(
      'text',
      { x: cx, y: tickY, class: 't-tick', 'text-anchor': 'middle' },
      textNode(`’${String(year.year).slice(2)}`)
    );
  });

  // Per-year totals over the bars: the quiet number row that stands in for an
  // axis — the only quantitative anchor a static SVG can offer.
  const totals = years.flatMap((year, i) => {
    if (year.sum === 0) return [];
    const cx = CARD_PADDING + i * band + band / 2;
    const barTop = baseline - (maxSum === 0 ? 0 : (year.sum / maxSum) * MAX_BAR_HEIGHT);
    return [
      el('text', { x: cx, y: barTop - 6, class: 't-tick', 'text-anchor': 'middle' }, textNode(formatCompact(year.sum))),
    ];
  });

  // Legend packed left-to-right by measured label width, on one row.
  let lx = CARD_PADDING;
  const legend: string[] = [];
  for (const series of SERIES) {
    const color = theme.seriesRamp[series.index];
    const caption = `${series.label} · ${formatCompact(typeTotals[series.index])}`;
    legend.push(
      el('rect', { x: lx, y: legendY - 9, width: 10, height: 10, rx: 2, fill: color }),
      el('text', { x: lx + 16, y: legendY, class: 't-label' }, textNode(caption))
    );
    lx += 16 + measureSans(caption, 12) + 20;
  }

  const privateCaption = el(
    'text',
    { x: CARD_WIDTH - CARD_PADDING, y: legendY, class: 't-mono', 'text-anchor': 'end' },
    textNode(`${(privateShare * 100).toFixed(0)}% PRIVATE`)
  );

  const baselineRule = el('line', {
    x1: CARD_PADDING,
    y1: baseline + 0.5,
    x2: CARD_WIDTH - CARD_PADDING,
    y2: baseline + 0.5,
    stroke: theme.border,
    'stroke-width': 1,
  });

  return cardFrame(
    {
      theme,
      height,
      title: 'Contribution composition',
      note: 'by type · incl. private',
      description: `Contribution composition by year for ${data.login}: commits, pull requests, issues, reviews, and private contributions.`,
      extraCss: `.bar{opacity:0;animation:grow ${motionDuration}s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, baselineRule, ...ticks, ...totals, ...legend, privateCaption),
    ...bars
  );
}
