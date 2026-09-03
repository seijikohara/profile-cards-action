/**
 * Top repositories card: ranked horizontal bars of the repositories the user
 * committed to most over the trailing year — including repositories they do
 * not own, so open-source contributions surface.
 *
 * Each row carries the repository's identity as well as its rank: a language
 * dot in linguist's color and, where anyone has starred it, a star count. Bars
 * take their fill from the contribution ramp, so the ranking reads the same way
 * as the calendar cards instead of singling the leader out in a second hue.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRepositories } from '../compute/repositories.js';
import { range } from '../iter.js';
import type { ProfileData } from '../model.js';
import { horizontalBar } from '../svg/bars.js';
import { el, num, textNode } from '../svg/dsl.js';
import { formatCompact, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { barFill } from './legend.js';

// Vertical rhythm of the card, in absolute user-space coordinates.
const BAND_TOP = 62;
const ROW_H = 30;
const BAR_H = 12;

// Horizontal geometry: rank, language dot, name, stars, then bars from a shared axis.
const RANK_X = CARD_PADDING + 12; // right edge of the rank column
const DOT_CX = CARD_PADDING + 25;
const LABEL_X = CARD_PADDING + 36;
const STARS_RIGHT = CARD_PADDING + 330; // right edge of the star count
const BAR_START_X = CARD_PADDING + 344;
const VALUE_GAP = 8;
const BAR_MAX_LEN = CARD_WIDTH - CARD_PADDING - BAR_START_X - 46; // leaves room for the end value

const MIN_BAR = 3; // keep a tiny non-zero value visible
const MAX_NAME = 36;
const TICK_SIZE = 9.5;
const STAR_R = 4.6;

/** Ellipsize long owner/name labels so they never run under the stars column. */
function truncate(name: string): string {
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

/**
 * Two-tone label: the owner prefix repeats down the list, so it wears the
 * muted ink while the repository name carries the row's identity in the
 * foreground color.
 */
function labelSpans(nameWithOwner: string, fg: string): string[] {
  const truncated = truncate(nameWithOwner);
  const slash = truncated.indexOf('/');
  if (slash < 0) return [el('tspan', { fill: fg }, textNode(truncated))];
  return [textNode(truncated.slice(0, slash + 1)), el('tspan', { fill: fg }, textNode(truncated.slice(slash + 1)))];
}

/**
 * Five-pointed star as a path rather than the ★ glyph: the embedded font is
 * subset to the characters the cards actually typeset, and a missing glyph
 * would fall back to whatever the viewer has.
 */
function star(cx: number, cy: number, radius: number, fill: string): string {
  const points = range(10).map((index) => {
    const r = index % 2 === 0 ? radius : radius * 0.42;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    return `${num(cx + r * Math.cos(angle))} ${num(cy + r * Math.sin(angle))}`;
  });
  return el('path', { d: `M${points.join('L')}Z`, fill });
}

/** Star count, right-aligned at `right`; empty for an unstarred repository. */
function starCount(stars: number, right: number, baseline: number, theme: Theme): string {
  if (stars <= 0) return '';
  const label = formatCompact(stars);
  const labelWidth = measureMono(label, TICK_SIZE);
  return (
    star(right - labelWidth - 4 - STAR_R, baseline - 3.4, STAR_R, theme.fgMuted) +
    el('text', { x: right, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode(label))
  );
}

export function renderRepositories(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const ranking = computeRepositories(data.topRepositories);

  const labels: string[] = [];
  const values: string[] = [];
  const bars: string[] = [];
  ranking.rows.forEach((row, index) => {
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    const length = ranking.max === 0 ? 0 : Math.max(MIN_BAR, (row.commits / ranking.max) * BAR_MAX_LEN);

    labels.push(
      el('text', { x: RANK_X, y: rowCenter + 3.3, class: 't-tick', 'text-anchor': 'end' }, textNode(String(index + 1))),
      el('circle', { cx: DOT_CX, cy: rowCenter, r: 4.5, fill: row.language?.color ?? theme.border }),
      el('text', { x: LABEL_X, y: rowCenter + 4, class: 't-label' }, ...labelSpans(row.nameWithOwner, theme.fg)),
      starCount(row.stars, STARS_RIGHT, rowCenter + 3.3, theme)
    );
    bars.push(
      el(
        'g',
        {
          class: 'hbar',
          style: `animation-delay:${index * 55}ms;transform-origin:${BAR_START_X}px ${rowCenter}px`,
        },
        horizontalBar(BAR_START_X, rowCenter - BAR_H / 2, length, BAR_H, barFill(theme, row.commits, ranking.max))
      )
    );
    values.push(
      el(
        'text',
        { x: BAR_START_X + length + VALUE_GAP, y: rowCenter + 3.3, class: 't-tick' },
        textNode(String(row.commits))
      )
    );
  });

  // An empty sweep still renders a valid, self-explanatory card.
  const empty =
    ranking.rows.length === 0
      ? el(
          'text',
          { x: CARD_PADDING, y: BAND_TOP + ROW_H / 2 + 4, class: 't-label' },
          textNode('No public commits in the trailing year')
        )
      : '';

  const bandRows = Math.max(1, ranking.rows.length);
  const bandBottom = BAND_TOP + bandRows * ROW_H;
  const footerBaseline = bandBottom + 27;

  // Scope disclosure: the list is a cut of a larger population, so say how
  // large — and when the cut bites, that it did.
  const scope = data.trailingCommits;
  const footerParts: string[] = [
    el('tspan', { class: 't-stat' }, textNode(formatCompact(scope.total))),
    textNode(' commits across '),
    el('tspan', { class: 't-stat' }, textNode(String(scope.repositories))),
    textNode(' repositories'),
  ];
  if (scope.repositories > ranking.rows.length && ranking.rows.length > 0) {
    footerParts.push(textNode(` · top ${ranking.rows.length} shown`));
  }
  const footer = el('text', { x: CARD_PADDING, y: footerBaseline, class: 't-label' }, ...footerParts);
  const key = rowKey(footerBaseline, theme, ranking.rows.length > 0);
  const axis = el('line', {
    x1: BAR_START_X - 0.5,
    y1: BAND_TOP,
    x2: BAR_START_X - 0.5,
    y2: bandBottom,
    stroke: theme.border,
    'stroke-width': 1,
  });

  const height = footerBaseline + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: 'Top repositories',
      note: 'trailing 12 months · by commits',
      description: `Top repositories for ${data.login}: repositories ranked by commits over the trailing year.`,
      extraCss: `.hbar{opacity:0;animation:growX .55s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, axis, ...labels, ...values, empty, footer, key),
    ...bars
  );
}

/** Names the two row glyphs, right-aligned on the footer baseline. */
function rowKey(baseline: number, theme: Theme, visible: boolean): string {
  if (!visible) return '';
  const starsWidth = STAR_R * 2 + 5 + measureMono('stars', TICK_SIZE);
  const languageWidth = 9 + 5 + measureMono('primary language', TICK_SIZE);
  const right = CARD_WIDTH - CARD_PADDING;
  const starsX = right - starsWidth;
  const languageX = starsX - 16 - languageWidth;
  return (
    el('circle', { cx: languageX + 4.5, cy: baseline - 3.4, r: 4.5, fill: theme.border }) +
    el('text', { x: languageX + 14, y: baseline, class: 't-tick' }, textNode('primary language')) +
    star(starsX + STAR_R, baseline - 3.4, STAR_R, theme.fgMuted) +
    el('text', { x: right, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode('stars'))
  );
}
