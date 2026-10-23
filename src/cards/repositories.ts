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

import { CircleDot, FolderGit2 } from 'lucide';
import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { computeRepositories } from '../compute/repositories.js';
import { range } from '../iter.js';
import type { ProfileData } from '../model.js';
import { horizontalBar } from '../svg/bars.js';
import { barPaint } from '../svg/effects.js';
import { el, num, textNode } from '../svg/dsl.js';
import { icon } from '../svg/icons.js';
import { formatCompact, formatInt, measureMono } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame } from './frame.js';
import { languageMark } from './language-mark.js';
import { repoLabelSpans, truncate } from './labels.js';
import { barFill } from './legend.js';

// Vertical rhythm of the card, in absolute user-space coordinates.
const BAND_TOP = 62;
const ROW_H = 30;
const BAR_H = 12;

// Horizontal geometry: rank, language mark, name, then a two-column numeric
// block (stars, issues) and the bars from a shared axis.
const RANK_X = CARD_PADDING + 12; // right edge of the rank column
const DOT_CX = CARD_PADDING + 25;
const MARK_SIZE = 13;
const LABEL_X = CARD_PADDING + 36;
const STARS_RIGHT = CARD_PADDING + 290; // right edge of the star count
const ISSUES_RIGHT = CARD_PADDING + 336; // right edge of the issue count
const ISSUE_ICON = 10;
const BAR_START_X = CARD_PADDING + 352;
const VALUE_GAP = 8;
const BAR_MAX_LEN = CARD_WIDTH - CARD_PADDING - BAR_START_X - 86; // leaves room for "412 / 1,208"

const MIN_BAR = 3; // keep a tiny non-zero value visible
const MAX_NAME = 36;
const TICK_SIZE = 9.5;
const NUM_SIZE = 10.5; // .t-num font-size, for measuring the counts
const STAR_R = 4.6;

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
  const labelWidth = measureMono(label, NUM_SIZE);
  return (
    star(right - labelWidth - 4 - STAR_R, baseline - 3.4, STAR_R, theme.fgMuted) +
    el('text', { x: right, y: baseline, class: 't-num', 'text-anchor': 'end' }, textNode(label))
  );
}

/**
 * Issues opened in the window, as a glyph and a count right-aligned at
 * `right`; empty when there were none, the same way stars are. A count says
 * how many; a shaded square could only say "some" or "more".
 */
function issueCount(issues: number, right: number, baseline: number, theme: Theme): string {
  if (issues <= 0) return '';
  const label = formatCompact(issues);
  const labelWidth = measureMono(label, NUM_SIZE);
  return (
    icon(CircleDot, right - labelWidth - 4 - ISSUE_ICON, baseline - 3.4 - ISSUE_ICON / 2, ISSUE_ICON, theme.fgMuted) +
    el('text', { x: right, y: baseline, class: 't-num', 'text-anchor': 'end' }, textNode(label))
  );
}

export function renderRepositories(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const ranking = computeRepositories(data.topRepositories);
  // The bullet track is scaled to the deepest history on the card, so a bar's
  // share of its own track reads directly as "how much of this repository's
  // history is recent".
  const trackMax = Math.max(ranking.max, ...ranking.rows.map((row) => row.lifetimeCommits));

  const labels: string[] = [];
  const values: string[] = [];
  const bars: string[] = [];
  ranking.rows.forEach((row, index) => {
    const rowCenter = BAND_TOP + index * ROW_H + ROW_H / 2;
    // Commits on branches other than the default are counted by the trailing
    // query but not by the lifetime one, so a bar can outrun its own track.
    // Clamp: a full track reads as "all of this history is recent", which is
    // what such a repository is.
    const trackLength = trackMax === 0 ? 0 : (Math.max(row.lifetimeCommits, row.commits) / trackMax) * BAR_MAX_LEN;
    const length = trackMax === 0 ? 0 : Math.max(MIN_BAR, (row.commits / trackMax) * BAR_MAX_LEN);

    labels.push(
      el('text', { x: RANK_X, y: rowCenter + 3.3, class: 't-tick', 'text-anchor': 'end' }, textNode(String(index + 1))),
      languageMark(row.language?.name, row.language?.color ?? theme.border, DOT_CX, rowCenter, MARK_SIZE),
      el(
        'text',
        { x: LABEL_X, y: rowCenter + 4, class: 't-label' },
        ...repoLabelSpans(row.nameWithOwner, theme.fg, MAX_NAME, data.login)
      ),
      starCount(row.stars, STARS_RIGHT, rowCenter + 3.3, theme),
      // Issues opened here in the same window: a second contribution type,
      // counted beside the stars.
      issueCount(row.issues, ISSUES_RIGHT, rowCenter + 3.3, theme),
      trackLength <= length ? '' : horizontalBar(BAR_START_X, rowCenter - BAR_H / 2, trackLength, BAR_H, theme.track)
    );
    bars.push(
      el(
        'g',
        {
          class: 'hbar',
          style: `animation-delay:${index * 55}ms;transform-origin:${BAR_START_X}px ${rowCenter}px`,
        },
        horizontalBar(
          BAR_START_X,
          rowCenter - BAR_H / 2,
          length,
          BAR_H,
          barPaint(theme, barFill(theme, row.commits, ranking.max), 'x', length)
        )
      )
    );
    values.push(
      el(
        'text',
        { x: BAR_START_X + Math.max(length, trackLength) + VALUE_GAP, y: rowCenter + 3.3, class: 't-num' },
        textNode(
          row.lifetimeCommits > row.commits
            ? `${formatCompact(row.commits)} / ${formatCompact(row.lifetimeCommits)}`
            : String(row.commits)
        )
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
    el('tspan', { class: 't-stat' }, textNode(formatInt(scope.total))),
    textNode(' commits across '),
    el('tspan', { class: 't-stat' }, textNode(String(scope.repositories))),
    textNode(' repositories'),
  ];
  if (scope.repositories > ranking.rows.length && ranking.rows.length > 0) {
    footerParts.push(textNode(` · top ${ranking.rows.length} shown`));
  }
  const footer = el('text', { x: CARD_PADDING, y: footerBaseline, class: 't-label' }, ...footerParts);
  const key = rowKey(footerBaseline, theme, ranking.rows.length > 0);

  // The only place on the deck where work outside the user's own repositories
  // surfaces by name. It degrades to nothing: the API nominates none in a quiet
  // year, and it returned null for several of this account's earlier windows.
  const popular = data.popularPullRequest;
  const popularBaseline = footerBaseline + 17;
  const popularLine =
    popular === null
      ? ''
      : el(
          'text',
          { x: CARD_PADDING, y: popularBaseline, class: 't-mono' },
          // The label is a caption and shouts like the others; the repository
          // name and the title are quoted text and keep their own case.
          textNode(`MOST DISCUSSED PR · ${popular.nameWithOwner} · ${truncate(popular.title, 62)}`)
        );
  const axis = el('line', {
    x1: BAR_START_X - 0.5,
    y1: BAND_TOP,
    x2: BAR_START_X - 0.5,
    y2: bandBottom,
    stroke: theme.border,
    'stroke-width': 1,
  });

  const height = (popular === null ? footerBaseline : popularBaseline) + CARD_PADDING;

  return cardFrame(
    {
      theme,
      icon: FolderGit2,
      height,
      title: 'Top repositories',
      note: 'by commits · bar past 12 months · track all time',
      description: `Top repositories for ${data.login}: repositories ranked by commits over the trailing year.`,
      extraCss: `.hbar{opacity:0;animation:growX .55s cubic-bezier(.2,.7,.3,1) forwards}`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, axis, ...labels, ...values, empty, footer, key, popularLine),
    ...bars
  );
}

/** Names the three row glyphs, right-aligned on the footer baseline. */
function rowKey(baseline: number, theme: Theme, visible: boolean): string {
  if (!visible) return '';
  const right = CARD_WIDTH - CARD_PADDING;
  const issuesWidth = ISSUE_ICON + 5 + measureMono('issues opened', TICK_SIZE);
  const starsWidth = STAR_R * 2 + 5 + measureMono('stars', TICK_SIZE);
  const languageWidth = 9 + 5 + measureMono('primary language', TICK_SIZE);
  const issuesX = right - issuesWidth;
  const starsX = issuesX - 16 - starsWidth;
  const languageX = starsX - 16 - languageWidth;
  return (
    el('circle', { cx: languageX + 4.5, cy: baseline - 3.4, r: 4.5, fill: theme.border }) +
    el('text', { x: languageX + 14, y: baseline, class: 't-tick' }, textNode('primary language')) +
    star(starsX + STAR_R, baseline - 3.4, STAR_R, theme.fgMuted) +
    el('text', { x: starsX + STAR_R * 2 + 5, y: baseline, class: 't-tick' }, textNode('stars')) +
    icon(CircleDot, issuesX, baseline - 3.4 - ISSUE_ICON / 2, ISSUE_ICON, theme.fgMuted) +
    el('text', { x: right, y: baseline, class: 't-tick', 'text-anchor': 'end' }, textNode('issues opened'))
  );
}
