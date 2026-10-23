/**
 * Shared card chrome: canvas, border, title row, typography classes, motion.
 *
 * Everything visual is embedded in the SVG itself (system font stacks, one
 * <style> block); GitHub's image proxy allows inline styles and blocks
 * scripts/external resources, so this is the entire budget.
 */

import type { IconNode } from 'lucide';
import { CARD_PADDING, CARD_RADIUS, CARD_WIDTH, PANEL_RADIUS } from '../config.js';
import { FONT_MONO, FONT_SANS, type Theme } from '../theme.js';
import { el, textNode } from '../svg/dsl.js';
import { effectDefs, LIFT } from '../svg/effects.js';
import { icon } from '../svg/icons.js';
import { deltaTriangle, sparkline } from '../svg/spark.js';
import { measureMono, measureSans } from '../svg/text.js';

export interface FrameOptions {
  readonly theme: Theme;
  readonly height: number;
  readonly title: string;
  /** Lucide icon set before the title; it names the card at a glance. */
  readonly icon: IconNode;
  /** Muted mono annotation at the title baseline, right-aligned — data provenance. */
  readonly note?: string;
  /** Accessible description of the card's content. */
  readonly description: string;
  /** Extra <style> rules appended to the shared block. */
  readonly extraCss?: string;
}

/**
 * A card's content in card-local coordinates, not yet placed in a document.
 *
 * The same card becomes a standalone SVG (`cardSvg`) or one section of a
 * combined sheet (`combinedSvg`), so the fonts, definitions, and canvas belong
 * to the document rather than to the card.
 */
export interface Card {
  readonly theme: Theme;
  readonly height: number;
  readonly title: string;
  readonly description: string;
  /** Card-specific <style> rules: motion classes and staggers. */
  readonly extraCss: string;
  /** The title row and the card's content. */
  readonly body: string;
}

const TITLE_BASELINE = 43;
const TITLE_ICON_SIZE = 15;

// The corner glow exists only on the dark canvas, where light reads as depth;
// on white the same tint reads as a smudge and breaks the card's match with
// the page.
const CORNER_GLOW = 0.06;

/**
 * Uppercase a note for the mono caption, except `@login` handles: a login is
 * an identifier, and GitHub shows it in its own case everywhere else.
 */
function noteCase(note: string): string {
  return note
    .split(' ')
    .map((word) => (word.startsWith('@') ? word : word.toUpperCase()))
    .join(' ');
}

/** Head the card's content with its icon, eyebrow title, and note. */
export function cardFrame(options: FrameOptions, ...children: string[]): Card {
  const { theme, height, title, note, description, extraCss } = options;
  const body = [
    icon(options.icon, CARD_PADDING, TITLE_BASELINE - 12, TITLE_ICON_SIZE, theme.ink),
    el(
      'text',
      { x: CARD_PADDING + TITLE_ICON_SIZE + 8, y: TITLE_BASELINE - 1, class: 't-title' },
      textNode(title.toUpperCase())
    ),
    note === undefined
      ? ''
      : el(
          'text',
          {
            x: CARD_WIDTH - CARD_PADDING,
            y: TITLE_BASELINE - 1,
            class: 't-mono',
            'text-anchor': 'end',
          },
          textNode(noteCase(note))
        ),
    ...children,
  ].join('');
  return { theme, height, title, description, extraCss: extraCss ?? '', body };
}

/** The document's <style>: fonts, type classes, and motion, then the cards' own rules. */
function documentCss(theme: Theme, fontFaceCss: string, extraCss: string): string {
  // Uppercase eyebrow type is wide; 11px mono with tracking reads as a label,
  // not a headline, and leaves the numbers as the loudest thing on the card.
  return `
${fontFaceCss}
text{font-family:'CardSans',${FONT_SANS};font-weight:400}
.t-title{font-family:'CardMono',${FONT_MONO};font-size:11px;font-weight:400;letter-spacing:1.6px;fill:${theme.ink}}
.t-value{font-size:30px;font-weight:600;letter-spacing:-.4px;fill:${theme.fg}}
.t-unit{font-size:14px;font-weight:400;fill:${theme.fgMuted}}
.t-label{font-size:12px;font-weight:400;fill:${theme.fgMuted}}
.t-stat{font-weight:600;fill:${theme.fg}}
.t-mono{font-family:'CardMono',${FONT_MONO};font-weight:400;font-size:10px;fill:${theme.fgMuted};letter-spacing:.4px}
.t-tick{font-family:'CardMono',${FONT_MONO};font-weight:400;font-size:9.5px;fill:${theme.fgMuted}}
.t-num{font-family:'CardMono',${FONT_MONO};font-weight:400;font-size:10.5px;fill:${theme.fg}}
.fade{opacity:0;animation:fade .5s ease .1s forwards}
@keyframes fade{to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes grow{from{opacity:0;transform:scaleY(0)}to{opacity:1;transform:scaleY(1)}}
@keyframes growX{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;opacity:1!important;transform:none!important}}
${extraCss}`;
}

/**
 * Open a document: title, description, styles, the paint servers and filters
 * every card may reference, and the canvas. Returns the root element's
 * attributes and its leading children.
 */
function documentHead(
  theme: Theme,
  height: number,
  title: string,
  description: string,
  css: string
): { attrs: Record<string, string | number>; head: string } {
  const attrs = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${CARD_WIDTH} ${height}`,
    width: CARD_WIDTH,
    height,
    role: 'img',
    'aria-label': description,
  };
  const head = [
    el('title', {}, textNode(title)),
    el('desc', {}, textNode(description)),
    el('style', {}, css),
    el(
      'defs',
      {},
      // stop-opacity, not opacity: the reduced-motion reset forces opacity to 1
      // on every element, which would turn the glow into a solid wash.
      theme.id === 'dark'
        ? el(
            'radialGradient',
            { id: 'glow', gradientUnits: 'userSpaceOnUse', cx: CARD_WIDTH, cy: 0, r: 460 },
            el('stop', { offset: 0, 'stop-color': theme.ink, 'stop-opacity': CORNER_GLOW }),
            el('stop', { offset: 1, 'stop-color': theme.ink, 'stop-opacity': 0 })
          )
        : '',
      // Area fills fade toward their baseline, which keeps the line on top as
      // the subject and the fill as a hint of volume.
      el(
        'linearGradient',
        { id: 'area', x1: 0, y1: 0, x2: 0, y2: 1 },
        el('stop', { offset: 0, 'stop-color': theme.contribRamp[3], 'stop-opacity': 0.32 }),
        el('stop', { offset: 1, 'stop-color': theme.contribRamp[3], 'stop-opacity': 0.02 })
      ),
      effectDefs(theme)
    ),
    el('rect', {
      x: 0.5,
      y: 0.5,
      width: CARD_WIDTH - 1,
      height: height - 1,
      rx: CARD_RADIUS,
      fill: theme.bg,
      stroke: theme.border,
    }),
    theme.id === 'dark'
      ? el('rect', {
          x: 0.5,
          y: 0.5,
          width: CARD_WIDTH - 1,
          height: height - 1,
          rx: CARD_RADIUS,
          fill: 'url(#glow)',
        })
      : '',
  ].join('');
  return { attrs, head };
}

/** Render one card as a standalone SVG document. */
export function cardSvg(card: Card, fontFaceCss: string): string {
  const { attrs, head } = documentHead(
    card.theme,
    card.height,
    card.title,
    card.description,
    documentCss(card.theme, fontFaceCss, card.extraCss)
  );
  return el('svg', attrs, head, card.body);
}

/**
 * Stack cards, in order, into one SVG document: one canvas, one copy of the
 * fonts and definitions, and a hairline between neighbouring cards.
 *
 * Each card keeps its own coordinate system inside a nested <svg> viewport:
 * a `transform` would be undone by the reduced-motion reset, and the cards'
 * user-space filters and transform origins are measured from their own top.
 */
export function combinedSvg(cards: readonly Card[], fontFaceCss: string): string {
  const theme = cards[0]?.theme;
  if (theme === undefined) throw new Error('A combined SVG needs at least one card.');
  if (cards.some((card) => card.theme !== theme)) throw new Error('Combined cards must share one theme.');
  const tops = cards.map((_, index) => cards.slice(0, index).reduce((sum, card) => sum + card.height, 0));
  const height = cards.reduce((sum, card) => sum + card.height, 0);
  // Two cards can share a rule (the same bar animation); one copy is enough.
  const extraCss = [...new Set(cards.map((card) => card.extraCss))].join('');
  const { attrs, head } = documentHead(
    theme,
    height,
    cards.map((card) => card.title).join(' · '),
    cards.map((card) => card.description).join(' '),
    documentCss(theme, fontFaceCss, extraCss)
  );
  const sections = cards.map((card, index) => {
    const top = tops[index] ?? 0;
    // The hairline sits on the boundary, inset to the content edges: it
    // separates two cards without boxing either one in.
    const divider =
      index === 0
        ? ''
        : el('rect', {
            x: CARD_PADDING,
            y: top,
            width: CARD_WIDTH - CARD_PADDING * 2,
            height: 1,
            fill: theme.borderMuted,
          });
    return divider + el('svg', { y: top, width: CARD_WIDTH, height: card.height }, card.body);
  });
  return el('svg', attrs, head, ...sections);
}

/** Change against a comparable earlier window, shown beside the value. */
export interface TileDelta {
  readonly rising: boolean;
  /** Short signed caption, e.g. "+38% YTD". */
  readonly text: string;
}

export interface TileSpec {
  readonly label: string;
  /** Lucide icon set before the label, in the palette's ink. */
  readonly icon: IconNode;
  readonly value: string;
  /** Optional muted unit rendered after the value (e.g. "days"). */
  readonly unit?: string;
  /** Optional mono caption under the value (e.g. a date range). */
  readonly sub?: string | undefined;
  /** Optional series drawn as a sparkline along the tile's foot. */
  readonly spark?: readonly number[] | undefined;
  /** The sparkline's last point covers a period still in progress (this year, this month). */
  readonly sparkPartial?: boolean;
  /**
   * Optional change chip, right-aligned on the value baseline — clear of the
   * caption, where it used to run into the caption's own words.
   */
  readonly delta?: TileDelta | undefined;
}

const TILE_GAP = 12;
const TILE_BASE_HEIGHT = 76;
const TILE_ICON_SIZE = 14;
const SUB_ROW = 18;
const SPARK_ROW = 30;
const SPARK_HEIGHT = 20;

/**
 * A row of stat tiles on the inset background. Returns the SVG plus the row
 * height.
 *
 * Every tile in a row is the same height, sparkline or not: only half the
 * counters here have a series the API can supply, and letting the others
 * shrink would turn a stat grid into a ragged one.
 */
export function tileRow(theme: Theme, tiles: readonly TileSpec[], y: number): { svg: string; height: number } {
  const hasSub = tiles.some((tile) => tile.sub !== undefined);
  const hasSpark = tiles.some((tile) => tile.spark !== undefined);
  const height = TILE_BASE_HEIGHT + (hasSub ? SUB_ROW : 0) + (hasSpark ? SPARK_ROW : 0);
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const width = (inner - TILE_GAP * (tiles.length - 1)) / tiles.length;
  const parts = tiles.map((tile, index) => {
    const x = CARD_PADDING + index * (width + TILE_GAP);
    const deltaRight = x + width - 16;
    // .t-mono adds .4px of letter-spacing per character, which measureMono
    // does not model; the extra clearance keeps the triangle off the text.
    const deltaWidth =
      tile.delta === undefined ? 0 : measureMono(tile.delta.text, 10) + tile.delta.text.length * 0.4 + 11;
    // The chip sits on the value line when it clears the number (measured
    // conservatively, so the real gap is wider than this margin), and
    // falls back to the caption line for a value too wide to share its row.
    const valueRight = x + 16 + measureSans(tile.value, 30, 'semibold');
    const deltaOnValue = deltaRight - deltaWidth >= valueRight + 6;
    const deltaBaseline = deltaOnValue ? y + 59 : y + 80;
    return el(
      'g',
      {},
      el('rect', {
        x: x + 0.5,
        y: y + 0.5,
        width: width - 1,
        height: height - 1,
        rx: PANEL_RADIUS,
        fill: theme.bgInset,
        // One separator per theme: a soft lift on white, a hairline on the
        // dark canvas, where a shadow has nothing to darken. Fill, hairline,
        // and shadow together read as three borders.
        stroke: theme.id === 'dark' ? theme.borderMuted : undefined,
        filter: theme.id === 'light' ? LIFT : undefined,
      }),
      icon(tile.icon, x + 16, y + 15, TILE_ICON_SIZE, theme.ink),
      el('text', { x: x + 16 + TILE_ICON_SIZE + 7, y: y + 26, class: 't-label' }, textNode(tile.label)),
      tile.delta === undefined
        ? ''
        : deltaTriangle(deltaRight - deltaWidth, deltaBaseline - 4, tile.delta.rising, theme.fg) +
            el(
              'text',
              { x: deltaRight, y: deltaBaseline, class: 't-mono', 'text-anchor': 'end' },
              textNode(tile.delta.text)
            ),
      el(
        'text',
        { x: x + 16, y: y + 61, class: 't-value' },
        textNode(tile.value),
        tile.unit === undefined ? '' : el('tspan', { class: 't-unit', dx: 6 }, textNode(tile.unit))
      ),
      tile.sub === undefined
        ? ''
        : el('text', { x: x + 16, y: y + 80, class: 't-mono' }, textNode(tile.sub.toUpperCase())),
      tile.spark === undefined
        ? ''
        : sparkline(tile.spark, x + 16, y + height - 12, width - 32, SPARK_HEIGHT, theme, tile.sparkPartial ?? false)
    );
  });
  return { svg: parts.join(''), height };
}
