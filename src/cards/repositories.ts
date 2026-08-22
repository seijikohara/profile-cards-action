/**
 * Top repositories card: ranked horizontal bars of the repositories the user
 * committed to most over the trailing year — including repositories they do
 * not own, so open-source contributions surface. The top repository is drawn
 * in the accent color; the rest reuse the calm contribution green.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRepositories } from '../compute/repositories.js';
import type { ProfileData } from '../model.js';
import { horizontalBar } from '../svg/bars.js';
import { el, textNode } from '../svg/dsl.js';
import { formatCompact } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';

// Vertical rhythm of the card, in absolute user-space coordinates.
const BAND_TOP = 62;
const ROW_H = 30;
const BAR_H = 12;

// Horizontal geometry: rank, then names, then bars emanating from a shared axis.
const RANK_X = CARD_PADDING + 12; // right edge of the rank column
const LABEL_X = CARD_PADDING + 24;
const BAR_START_X = CARD_PADDING + 290;
const VALUE_GAP = 8;
const BAR_MAX_LEN = CARD_WIDTH - CARD_PADDING - BAR_START_X - 46; // leaves room for the end value

const MIN_BAR = 3; // keep a tiny non-zero value visible
const MAX_NAME = 38;

/** Ellipsize long owner/name labels so they never run under the bars. */
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

export function renderRepositories(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const ranking = computeRepositories(data.topRepositories);
  const calmFill = theme.contribRamp[2];

  const labels: string[] = [];
  const values: string[] = [];
  const bars: string[] = [];
  ranking.rows.forEach((row, index) => {
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    const length = ranking.max === 0 ? 0 : Math.max(MIN_BAR, (row.commits / ranking.max) * BAR_MAX_LEN);
    const fill = index === 0 ? theme.accent : calmFill;

    labels.push(
      el('text', { x: RANK_X, y: rowCenter + 3.3, class: 't-tick', 'text-anchor': 'end' }, textNode(String(index + 1))),
      el('text', { x: LABEL_X, y: rowCenter + 4, class: 't-label' }, ...labelSpans(row.nameWithOwner, theme.fg))
    );
    bars.push(
      el(
        'g',
        {
          class: 'hbar',
          style: `animation-delay:${index * 55}ms;transform-origin:${BAR_START_X}px ${rowCenter}px`,
        },
        horizontalBar(BAR_START_X, rowCenter - BAR_H / 2, length, BAR_H, fill)
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
    el('g', { class: 'fade' }, axis, ...labels, ...values, empty, footer),
    ...bars
  );
}
