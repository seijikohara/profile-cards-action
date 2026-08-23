/** Languages card: a squarified treemap by bytes with a full-coverage legend. */

import { CARD_PADDING, CARD_WIDTH } from '../config.js';
import { languageShares, type LanguageShare } from '../compute/languages.js';
import type { TreemapRect } from '../compute/treemap.js';
import { squarify } from '../compute/treemap.js';
import type { ProfileData } from '../model.js';
import { el, textNode } from '../svg/dsl.js';
import { formatBytes, formatInt } from '../svg/text.js';
import { contrast, type Theme } from '../theme.js';
import { cardFrame } from './frame.js';

const TREE_TOP = 60;
const TREE_HEIGHT = 190;
const LEGEND_TOP_GAP = 30;
const LEGEND_COLUMNS = 3;
const LEGEND_ROW_HEIGHT = 30;

// In-cell label tiers by cell height (at LABEL_MIN_WIDTH or wider): the name
// needs ~26px, the percentage line ~44px, the bytes line ~64px. Every tier's
// last baseline clears the cell bottom — the old single 30px threshold let the
// percentage baseline (y+34) fall outside the cell and clip.
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

  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const rects = squarify(
    shares.map((share) => share.bytes),
    CARD_PADDING,
    TREE_TOP,
    inner,
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

    const label = cellLabel(share, rect, fill);

    return el('g', { class: `fade c${rect.index}` }, rectEl, label);
  });

  // Legend lists every share, so each name and percentage appears regardless of
  // how small its treemap cell is.
  const legendTop = TREE_TOP + TREE_HEIGHT + LEGEND_TOP_GAP;
  const columnWidth = inner / LEGEND_COLUMNS;
  const legend = shares.map((share, index) => {
    const column = index % LEGEND_COLUMNS;
    const row = Math.floor(index / LEGEND_COLUMNS);
    const x = CARD_PADDING + column * columnWidth;
    const y = legendTop + row * LEGEND_ROW_HEIGHT;
    return el(
      'g',
      {},
      el('circle', { cx: x + 5, cy: y - 4, r: 5, fill: cellFill(share, theme) }),
      el('text', { x: x + 18, y, class: 'leg-name' }, textNode(share.name)),
      el(
        'text',
        { x: x + columnWidth - 70, y, class: 't-tick', 'text-anchor': 'end' },
        textNode(formatBytes(share.bytes))
      ),
      el(
        'text',
        { x: x + columnWidth - 16, y, class: 't-tick', 'text-anchor': 'end' },
        textNode(`${share.pct.toFixed(1)}%`)
      )
    );
  });

  const legendRows = Math.ceil(shares.length / LEGEND_COLUMNS);
  const legendBottom = legendTop + (legendRows - 1) * LEGEND_ROW_HEIGHT;

  // Footer: the population the treemap slices — counts before Other-folding.
  const totalBytes = data.languages.reduce((sum, slice) => sum + slice.bytes, 0);
  const footerBaseline = legendBottom + 30;
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
    el('g', { class: 'fade' }, ...legend, footer)
  );
}
