/**
 * Portfolio card: one lifeline per owned repository on a shared time axis.
 *
 * The other repository card ranks by what the user did last year; this one
 * unflattens the dimension every other card sums away — which projects exist,
 * when each started, and when each was last touched.
 *
 * The ramp encodes push recency as magnitude, the same reading the calendar
 * cards teach. It is deliberately never called health: `pushedAt` moves for a
 * push by any author, automation included, and a finished library needs no
 * pushes at all.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { range } from '../iter.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import { formatBytes, formatCompact, formatInt, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { repoLabelSpans } from './labels.js';

/** Rows the card draws. Beyond this the lifelines stop resolving as separate. */
const MAX_ROWS = 12;

// Vertical rhythm, in absolute user-space coordinates.
const HEAD_BASELINE = 62;
const BAND_TOP = 78;
const ROW_H = 24;

// Horizontal columns.
const DOT_CX = CARD_PADDING + 5;
const NAME_X = CARD_PADDING + 18;
const MAX_NAME = 34;
const TRACK_X = CARD_PADDING + 244;
const COMMITS_RIGHT = CARD_WIDTH - CARD_PADDING - 66;
const LICENSE_RIGHT = CARD_WIDTH - CARD_PADDING;
const TRACK_WIDTH = COMMITS_RIGHT - 46 - TRACK_X;

const LIFELINE_H = 4;
const END_DOT_R = 3.4;

const DAY_MS = 86_400_000;

/** Height of the stub shown when there is nothing to plot. */
const STUB_HEIGHT = 96;

/**
 * Ramp level for how recently a repository was pushed. Level 0 is reserved for
 * "no data", so an ancient repository still reads as a mark rather than a gap.
 */
function recencyLevel(pushedAt: string | null, nowMs: number): 1 | 2 | 3 | 4 {
  if (pushedAt === null) return 1;
  const days = (nowMs - Date.parse(pushedAt)) / DAY_MS;
  if (days < 30) return 4;
  if (days < 90) return 3;
  if (days < 365) return 2;
  return 1;
}

export function renderPortfolio(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const rows = data.repositories.slice(0, MAX_ROWS);
  const totals = data.repositories;

  if (rows.length === 0) {
    return cardFrame(
      {
        theme,
        height: STUB_HEIGHT,
        title: 'Portfolio',
        note: 'public source repositories',
        description: `No public source repositories for ${data.login}.`,
        fontFaceCss,
      },
      el('text', { x: CARD_PADDING, y: 72, class: 't-label' }, textNode('No public source repositories'))
    );
  }

  // The axis spans the oldest drawn repository to the newest activity anywhere
  // in the portfolio, so a row's bar length is comparable with its neighbours'.
  const nowMs = Math.max(
    ...totals.map((repo) => (repo.pushedAt === null ? 0 : Date.parse(repo.pushedAt))),
    Date.parse(data.generatedAt)
  );
  const startMs = Math.min(...rows.map((repo) => Date.parse(repo.createdAt)));
  const span = Math.max(1, nowMs - startMs);
  const x = (ms: number): number => TRACK_X + ((ms - startMs) / span) * TRACK_WIDTH;

  const lifelines = rows.map((repo, index) => {
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    const level = recencyLevel(repo.pushedAt, nowMs);
    const fill = theme.contribRamp[level];
    const from = x(Date.parse(repo.createdAt));
    const to = repo.pushedAt === null ? from : x(Date.parse(repo.pushedAt));
    // An empty repository has no push to end at; keep the created mark alone
    // rather than drawing a zero-length bar that reads as a rendering fault.
    const bar =
      repo.pushedAt === null
        ? ''
        : el('rect', {
            x: from,
            y: rowCenter - LIFELINE_H / 2,
            width: Math.max(LIFELINE_H, to - from),
            height: LIFELINE_H,
            rx: LIFELINE_H / 2,
            fill,
          });
    return el(
      'g',
      { class: 'life', style: `animation-delay:${index * 45}ms` },
      bar,
      el('circle', { cx: to, cy: rowCenter, r: END_DOT_R, fill })
    );
  });

  const labels = rows.flatMap((repo, index) => {
    const baseline = BAND_TOP + index * ROW_H + ROW_H / 2 + 4;
    return [
      el('circle', { cx: DOT_CX, cy: baseline - 4, r: 4.5, fill: repo.language?.color ?? theme.border }),
      el(
        'text',
        { x: NAME_X, y: baseline, class: 't-label' },
        ...repoLabelSpans(repo.nameWithOwner, theme.fg, MAX_NAME)
      ),
      el(
        'text',
        { x: COMMITS_RIGHT, y: baseline - 0.7, class: 't-tick', 'text-anchor': 'end' },
        textNode(formatCompact(repo.commits))
      ),
      el(
        'text',
        { x: LICENSE_RIGHT, y: baseline - 0.7, class: 't-tick', 'text-anchor': 'end' },
        textNode(repo.license ?? '—')
      ),
    ];
  });

  const bandBottom = BAND_TOP + rows.length * ROW_H;
  const tickBaseline = bandBottom + 17;
  const ticks = yearTicks(startMs, nowMs).map((tick) =>
    el(
      'text',
      { x: x(tick.ms), y: tickBaseline, class: 't-tick', 'text-anchor': 'middle' },
      textNode(String(tick.year))
    )
  );
  const axisRule = el('line', {
    x1: TRACK_X,
    y1: bandBottom + 0.5,
    x2: TRACK_X + TRACK_WIDTH,
    y2: bandBottom + 0.5,
    stroke: theme.border,
    'stroke-width': 1,
  });

  const columnHeads =
    el('text', { x: CARD_PADDING, y: HEAD_BASELINE, class: 't-mono' }, textNode('REPOSITORY')) +
    el('text', { x: TRACK_X, y: HEAD_BASELINE, class: 't-mono' }, textNode('CREATED → LAST PUSH')) +
    el('text', { x: COMMITS_RIGHT, y: HEAD_BASELINE, class: 't-mono', 'text-anchor': 'end' }, textNode('COMMITS')) +
    el('text', { x: LICENSE_RIGHT, y: HEAD_BASELINE, class: 't-mono', 'text-anchor': 'end' }, textNode('LICENSE'));

  const recent = totals.filter((repo) => recencyLevel(repo.pushedAt, nowMs) >= 3).length;
  const licensed = totals.filter((repo) => repo.license !== null).length;
  const disk = totals.reduce((sum, repo) => sum + repo.diskUsageKb, 0) * 1000;
  const footerBaseline = tickBaseline + 28;
  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatInt(totals.length))),
    textNode(' source repositories · '),
    el('tspan', { class: 't-stat' }, textNode(formatInt(recent))),
    textNode(' pushed in the last 90 days · '),
    el('tspan', { class: 't-stat' }, textNode(formatInt(licensed))),
    textNode(' licensed · '),
    el('tspan', { class: 't-stat' }, textNode(formatBytes(disk))),
    textNode(' on disk'),
  ];
  if (totals.length > rows.length) {
    footerParts.push(textNode(` · top ${rows.length} shown`));
  }
  const footer = el('text', { x: CARD_PADDING, y: footerBaseline, class: 't-label' }, ...footerParts);

  // The ramp's only job here is recency, and the caveat travels with the key:
  // a push is a push by anyone, so this is not a maintenance score.
  const key = recencyKey(theme, footerBaseline);

  return cardFrame(
    {
      theme,
      height: footerBaseline + CARD_PADDING,
      title: 'Portfolio',
      note: 'public source repositories · by commits',
      description:
        `Repository portfolio for ${data.login}: ${formatInt(totals.length)} public source repositories, ` +
        `${formatInt(recent)} pushed in the last 90 days.`,
      extraCss: `.life{opacity:0;animation:fade .45s ease forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, columnHeads, axisRule, ...ticks, ...labels, footer, key),
    ...lifelines
  );
}

/** Ramp key naming what the lifeline colors mean, right-aligned on `baseline`. */
function recencyKey(theme: Theme, baseline: number): string {
  const caption = 'pushed recently, any author';
  const swatch = 9;
  const pitch = 12;
  const captionWidth = measureMono(caption, 9.5);
  const right = CARD_WIDTH - CARD_PADDING;
  const firstX = right - captionWidth - 8 - pitch * 4;
  return (
    range(4)
      .map((step) =>
        el('rect', {
          x: firstX + step * pitch,
          y: baseline - swatch + 1,
          width: swatch,
          height: swatch,
          rx: 2,
          fill: theme.contribRamp[step + 1],
        })
      )
      .join('') + el('text', { x: right, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(caption))
  );
}

/** One tick per January the axis spans, plus the axis start. */
function yearTicks(startMs: number, endMs: number): { readonly ms: number; readonly year: number }[] {
  const firstYear = new Date(startMs).getUTCFullYear();
  const lastYear = new Date(endMs).getUTCFullYear();
  return range(lastYear - firstYear + 1).flatMap((offset) => {
    const year = firstYear + offset;
    const ms = Date.UTC(year, 0, 1);
    return ms >= startMs && ms <= endMs ? [{ ms, year }] : [];
  });
}
