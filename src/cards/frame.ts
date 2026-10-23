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
import { icon } from '../svg/icons.js';
import { deltaTriangle, sparkline } from '../svg/spark.js';
import { measureMono } from '../svg/text.js';

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
  /** Pre-built `@font-face` rules, injected verbatim into the card's <style>. */
  readonly fontFaceCss?: string;
}

const TITLE_BASELINE = 43;
const TITLE_ICON_SIZE = 15;

/** Paint server for headline numbers: the palette's ink drifting to its neighbouring hue. */
const INK_GRADIENT = 'url(#ink)';

export function cardFrame(options: FrameOptions, ...children: string[]): string {
  const { theme, height, title, note, description, extraCss, fontFaceCss } = options;
  // Uppercase eyebrow type is wide; 11px mono with tracking reads as a label,
  // not a headline, and leaves the numbers as the loudest thing on the card.
  const css = `
${fontFaceCss ?? ''}
text{font-family:'CardSans',${FONT_SANS};font-weight:400}
.t-title{font-family:'CardMono',${FONT_MONO};font-size:11px;font-weight:400;letter-spacing:1.6px;fill:${theme.ink}}
.t-value{font-size:30px;font-weight:600;letter-spacing:-.4px;fill:${theme.fg}}
.t-hero{fill:${INK_GRADIENT}}
.t-unit{font-size:14px;font-weight:400;fill:${theme.fgMuted}}
.t-label{font-size:12px;font-weight:400;fill:${theme.fgMuted}}
.t-stat{font-weight:600;fill:${theme.fg}}
.t-mono{font-family:'CardMono',${FONT_MONO};font-weight:400;font-size:10px;fill:${theme.fgMuted};letter-spacing:.4px}
.t-tick{font-family:'CardMono',${FONT_MONO};font-weight:400;font-size:9.5px;fill:${theme.fgMuted}}
.fade{opacity:0;animation:fade .5s ease .1s forwards}
@keyframes fade{to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes grow{from{opacity:0;transform:scaleY(0)}to{opacity:1;transform:scaleY(1)}}
@keyframes growX{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;opacity:1!important;transform:none!important}}
${extraCss ?? ''}`;

  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${CARD_WIDTH} ${height}`,
      width: CARD_WIDTH,
      height,
      role: 'img',
      'aria-label': description,
    },
    el('title', {}, textNode(title)),
    el('desc', {}, textNode(description)),
    el('style', {}, css),
    el(
      'defs',
      {},
      // stop-opacity, not opacity: the reduced-motion reset forces opacity to 1
      // on every element, which would turn the glow into a solid wash.
      el(
        'radialGradient',
        { id: 'glow', gradientUnits: 'userSpaceOnUse', cx: CARD_WIDTH, cy: 0, r: 460 },
        el('stop', { offset: 0, 'stop-color': theme.ink, 'stop-opacity': theme.id === 'light' ? 0.07 : 0.1 }),
        el('stop', { offset: 1, 'stop-color': theme.ink, 'stop-opacity': 0 })
      ),
      el(
        'linearGradient',
        { id: 'ink', x1: 0, y1: 0, x2: 1, y2: 0 },
        el('stop', { offset: 0, 'stop-color': theme.ink }),
        el('stop', { offset: 1, 'stop-color': theme.inkAlt })
      ),
      // Area fills fade toward their baseline, which keeps the line on top as
      // the subject and the fill as a hint of volume.
      el(
        'linearGradient',
        { id: 'area', x1: 0, y1: 0, x2: 0, y2: 1 },
        el('stop', { offset: 0, 'stop-color': theme.contribRamp[3], 'stop-opacity': 0.32 }),
        el('stop', { offset: 1, 'stop-color': theme.contribRamp[3], 'stop-opacity': 0.02 })
      )
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
    el('rect', {
      x: 0.5,
      y: 0.5,
      width: CARD_WIDTH - 1,
      height: height - 1,
      rx: CARD_RADIUS,
      fill: 'url(#glow)',
    }),
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
          textNode(note.toUpperCase())
        ),
    ...children
  );
}

/** Change against a comparable earlier window, shown beside the caption. */
export interface TileDelta {
  readonly rising: boolean;
  /** Short caption, e.g. "38% YTD". */
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
  /** Optional change chip, right-aligned on the caption baseline. */
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
        stroke: theme.borderMuted,
      }),
      icon(tile.icon, x + 16, y + 15, TILE_ICON_SIZE, theme.ink),
      el('text', { x: x + 16 + TILE_ICON_SIZE + 7, y: y + 26, class: 't-label' }, textNode(tile.label)),
      tile.delta === undefined
        ? ''
        : // .t-mono adds .4px of letter-spacing per character, which measureMono
          // does not model; the extra clearance keeps the triangle off the text.
          deltaTriangle(
            deltaRight - measureMono(tile.delta.text, 10) - tile.delta.text.length * 0.4 - 11,
            y + 76,
            tile.delta.rising,
            theme.fg
          ) +
            el('text', { x: deltaRight, y: y + 80, class: 't-mono', 'text-anchor': 'end' }, textNode(tile.delta.text)),
      el(
        'text',
        { x: x + 16, y: y + 61, class: 't-value' },
        textNode(tile.value),
        tile.unit === undefined ? '' : el('tspan', { class: 't-unit', dx: 6 }, textNode(tile.unit))
      ),
      tile.sub === undefined
        ? ''
        : el('text', { x: x + 16, y: y + 80, class: 't-mono' }, textNode(tile.sub.toUpperCase())),
      tile.spark === undefined ? '' : sparkline(tile.spark, x + 16, y + height - 12, width - 32, SPARK_HEIGHT, theme)
    );
  });
  return { svg: parts.join(''), height };
}
