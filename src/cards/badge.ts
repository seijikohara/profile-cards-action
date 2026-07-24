/**
 * Link badge: a quiet Primer pill with an optional brand glyph.
 *
 * Brands absent from simple-icons render text-only — never a lookalike mark
 * (LinkedIn's icon was removed from the icon set for legal reasons).
 */

import { el, textNode } from '../svg/dsl.js';
import { measureSans } from '../svg/text.js';
import { contrast, FONT_SANS, type Theme } from '../theme.js';

export interface BadgeIcon {
  /** 24x24 viewBox path data from simple-icons. */
  readonly path: string;
  /** Brand color, e.g. "#3EA8FF". */
  readonly hex: string;
}

const HEIGHT = 32;
const PAD_X = 14;
const ICON_SIZE = 16;
const ICON_GAP = 8;
const LABEL_SIZE = 13;

export function renderBadge(label: string, icon: BadgeIcon | undefined, theme: Theme): string {
  const labelWidth = Math.ceil(measureSans(label, LABEL_SIZE, 'semibold'));
  const iconSpan = icon ? ICON_SIZE + ICON_GAP : 0;
  const width = PAD_X + iconSpan + labelWidth + PAD_X;

  // Keep the brand color only when it is visible on the pill in this theme.
  const iconFill = icon === undefined ? theme.fg : contrast(icon.hex, theme.bgInset) >= 1.6 ? icon.hex : theme.fg;

  const glyph =
    icon === undefined
      ? ''
      : el(
          'g',
          {
            transform: `translate(${PAD_X},${(HEIGHT - ICON_SIZE) / 2}) scale(${ICON_SIZE / 24})`,
          },
          el('path', { d: icon.path, fill: iconFill })
        );

  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${width} ${HEIGHT}`,
      width,
      height: HEIGHT,
      role: 'img',
      'aria-label': label,
    },
    el('title', {}, textNode(label)),
    el('style', {}, `text{font-family:${FONT_SANS};font-size:${LABEL_SIZE}px;font-weight:600;fill:${theme.fg}}`),
    el('rect', {
      x: 0.5,
      y: 0.5,
      width: width - 1,
      height: HEIGHT - 1,
      rx: 6,
      fill: theme.bgInset,
      stroke: theme.border,
    }),
    glyph,
    el('text', { x: PAD_X + iconSpan, y: HEIGHT / 2 + LABEL_SIZE / 2 - 2 }, textNode(label))
  );
}
