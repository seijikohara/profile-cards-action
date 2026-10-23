/**
 * Brand-badge rendering: resolve arbitrary link names to simple-icons glyphs
 * and emit one pill SVG per theme.
 *
 * Lookup is by free-form display name, so the entire simple-icons set must stay
 * reachable at runtime — the package is bundled whole (dynamic lookup defeats
 * tree-shaking), which is an accepted cost. Names with no matching icon render
 * text-only rather than a lookalike mark.
 */

import { renderBadge, type BadgeIcon } from './cards/badge.js';
import { findBrand } from './svg/brands.js';
import type { Theme } from './theme.js';

/** Reduce a name to a filename stem: lowercase, collapse non-alphanumeric runs to '-', trim edges. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Render brand-badge pill SVGs. Returns a map of relative filename -> SVG string. */
export function renderBadges(names: readonly string[], themes: readonly Theme[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of names) {
    const found = findBrand(name);
    // badge.ts applies its own per-theme contrast rule to the brand color.
    const icon: BadgeIcon | undefined = found ? { path: found.path, hex: `#${found.hex}` } : undefined;
    const stem = slug(name);
    for (const theme of themes) {
      out.set(`${stem}.${theme.id}.svg`, renderBadge(name, icon, theme));
    }
  }
  return out;
}
