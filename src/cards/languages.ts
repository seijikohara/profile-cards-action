/**
 * Languages card: a ranked list beside a squarified treemap, both by bytes.
 *
 * The list is the card's index and sits on the left, where a reader's eye
 * starts: one row per language, top to bottom in size order, so the ranking is
 * legible without decoding cell areas. The treemap holds the proportions the
 * list cannot show. A three-column legend under the map read in reading order
 * — across, then down — which put rank 4 directly below rank 1.
 */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { languageShares, type LanguageShare } from '../compute/languages.js';
import type { TreemapRect } from '../compute/treemap.js';
import { squarify } from '../compute/treemap.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import { formatBytes, formatInt } from '../svg/text.js';
import { contrast, type Theme } from '../theme.js';
import { cardFrame } from './frame.js';

const CONTENT_TOP = 60;

// Left column: the ranked list.
const LIST_WIDTH = 250;
const LIST_ROW_HEIGHT = 27;
const LIST_FIRST_BASELINE = CONTENT_TOP + 15;
const LIST_NAME_X = CARD_PADDING + 18;
const LIST_BYTES_RIGHT = CARD_PADDING + 176;
const LIST_PCT_RIGHT = CARD_PADDING + LIST_WIDTH;

// Right column: the treemap.
const COLUMN_GAP = 20;
const TREE_X = CARD_PADDING + LIST_WIDTH + COLUMN_GAP;
const TREE_WIDTH = CARD_WIDTH - CARD_PADDING - TREE_X;
const TREE_HEIGHT = 250;

// In-cell label tiers by cell height (at LABEL_MIN_WIDTH or wider): the name
// needs ~26px, the percentage line ~44px, the bytes line ~64px. Every tier's
// last baseline clears the cell bottom.
const LABEL_MIN_WIDTH = 54;
const NAME_MIN_HEIGHT = 26;
const PCT_MIN_HEIGHT = 44;
const BYTES_MIN_HEIGHT = 64;

/** Fill for a share: its linguist color, or the muted token for "Other" and colorless languages. */
function cellFill(share: LanguageShare, theme: Theme): string {
  return share.color ?? theme.fgMuted;
}

/** In-cell label lines, tiered by the cell's height; '' when the cell is too small. */
function cellLabel(share: LanguageShare, rect: TreemapRect, fill: string): string {
  if (rect.width < LABEL_MIN_WIDTH || rect.height < NAME_MIN_HEIGHT) return '';
  // On-cell ink: white or near-black, whichever contrasts more with the fill.
  const ink = contrast(fill, '#ffffff') >= contrast(fill, '#1f2328') ? '#ffffff' : '#1f2328';
  const tx = rect.x + 9;
  return [
    el('text', { x: tx, y: rect.y + 20, class: 'lang', fill: ink }, textNode(share.name)),
    ...(rect.height >= PCT_MIN_HEIGHT
      ? [el('text', { x: tx, y: rect.y + 34, class: 'lang-pct', fill: ink }, textNode(`${share.pct.toFixed(1)}%`))]
      : []),
    ...(rect.height >= BYTES_MIN_HEIGHT
      ? [el('text', { x: tx, y: rect.y + 50, class: 'lang-pct', fill: ink }, textNode(formatBytes(share.bytes)))]
      : []),
  ].join('');
}

export function renderLanguages(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const shares = languageShares(data.languages);

  if (shares.length === 0) {
    return cardFrame(
      {
        theme,
        height: 96,
        title: 'Languages',
        description: `No language data for ${data.login}.`,
        fontFaceCss,
      },
      el('text', { x: CARD_PADDING, y: 72, class: 't-label' }, textNode('No language data'))
    );
  }

  const rects = squarify(
    shares.map((share) => share.bytes),
    TREE_X,
    CONTENT_TOP,
    TREE_WIDTH,
    TREE_HEIGHT
  );

  // One faded, staggered group per cell: an inset rounded rect (the 1px inset on
  // every side leaves ~2px of card background between neighbors) plus an optional
  // in-cell label when the cell is large enough to hold it.
  const cells = rects.map((rect) => {
    const share = shares[rect.index];
    if (share === undefined) return '';
    const fill = cellFill(share, theme);
    const rectEl = el('rect', {
      x: rect.x + 1,
      y: rect.y + 1,
      width: Math.max(0, rect.width - 2),
      height: Math.max(0, rect.height - 2),
      rx: 2,
      fill,
    });

    return el('g', { class: `fade c${rect.index}` }, rectEl, cellLabel(share, rect, fill));
  });

  // The ranked list covers every share, so each name, size, and percentage
  // appears however small its treemap cell turns out to be.
  const list = shares.map((share, index) => {
    const y = LIST_FIRST_BASELINE + index * LIST_ROW_HEIGHT;
    return el(
      'g',
      {},
      el('circle', { cx: CARD_PADDING + 5, cy: y - 4, r: 5, fill: cellFill(share, theme) }),
      el('text', { x: LIST_NAME_X, y, class: 'leg-name' }, textNode(share.name)),
      el('text', { x: LIST_BYTES_RIGHT, y, class: 't-tick', 'text-anchor': 'end' }, textNode(formatBytes(share.bytes))),
      el('text', { x: LIST_PCT_RIGHT, y, class: 't-tick', 'text-anchor': 'end' }, textNode(`${share.pct.toFixed(1)}%`))
    );
  });

  const contentBottom = Math.max(CONTENT_TOP + TREE_HEIGHT, CONTENT_TOP + shares.length * LIST_ROW_HEIGHT);

  // Footer: the population the treemap slices — counts before Other-folding.
  const totalBytes = data.languages.reduce((sum, slice) => sum + slice.bytes, 0);
  const footerBaseline = contentBottom + 28;
  const footer = el(
    'text',
    { x: CARD_PADDING, y: footerBaseline, class: 't-label' },
    el('tspan', { class: 't-stat' }, textNode(String(data.languages.length))),
    textNode(' languages across '),
    el('tspan', { class: 't-stat' }, textNode(formatInt(data.publicSourceRepos))),
    textNode(' source repositories · '),
    el('tspan', { class: 't-stat' }, textNode(formatBytes(totalBytes)))
  );

  const height = footerBaseline + CARD_PADDING;

  // Per-cell fade delay, keyed by the share's rank and capped so the last cell is
  // not left far behind the first. Delay is overridden per class rather than
  // inline so all motion stays in the one <style> block (and honors the frame's
  // reduced-motion reset).
  const stagger = rects
    .map((rect) => `.c${rect.index}{animation-delay:${Math.min(rect.index * 0.05, 0.6).toFixed(2)}s}`)
    .join('');
  const extraCss =
    `.lang{font-size:13px;font-weight:600}` +
    `.lang-pct{font-size:10.5px}` +
    `.leg-name{font-size:13px;fill:${theme.fg}}` +
    stagger;

  const top = shares[0];
  const lead = top ? `, led by ${top.name} at ${top.pct.toFixed(1)}%` : '';
  return cardFrame(
    {
      theme,
      height,
      title: 'Languages',
      note: 'public source repositories · by bytes',
      description: `Language breakdown for ${data.login} by bytes${lead}.`,
      extraCss,
      fontFaceCss,
    },
    ...cells,
    el('g', { class: 'fade' }, ...list, footer)
  );
}
