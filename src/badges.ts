/**
 * Brand-badge rendering: resolve arbitrary link names to simple-icons glyphs
 * and emit one pill SVG per theme.
 *
 * Lookup is by free-form display name, so the entire simple-icons set must stay
 * reachable at runtime — the package is bundled whole (dynamic lookup defeats
 * tree-shaking), which is an accepted cost. Names with no matching icon render
 * text-only rather than a lookalike mark.
 */

import * as simpleIcons from 'simple-icons';
import { renderBadge, type BadgeIcon } from './cards/badge.js';
import type { Theme } from './theme.js';

/** Minimal shape consumed here; simple-icons objects carry more (svg, source, license). */
interface IconRecord {
  readonly title: string;
  readonly slug: string;
  readonly path: string;
  readonly hex: string;
}

/**
 * Narrow an arbitrary module export to an icon object.
 *
 * Guards against non-icon exports (helper functions in some releases) so the
 * index only ever holds renderable glyphs.
 */
function isIcon(value: unknown): value is IconRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<IconRecord>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.hex === 'string'
  );
}

/** Reduce a name to its icon-lookup key: lowercase, drop every non-alphanumeric char. */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Reduce a name to a filename stem: lowercase, collapse non-alphanumeric runs to '-', trim edges. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Index every simple-icons glyph by the normalized form of both its title and
 * its slug. Built once at module load; earlier entries win on key collision to
 * keep the mapping deterministic across the fixed export order.
 */
const ICON_INDEX: ReadonlyMap<string, IconRecord> = (() => {
  const index = new Map<string, IconRecord>();
  for (const value of Object.values(simpleIcons)) {
    if (!isIcon(value)) continue;
    for (const key of [normalizeKey(value.title), normalizeKey(value.slug)]) {
      if (key !== '' && !index.has(key)) index.set(key, value);
    }
  }
  return index;
})();

/** Render brand-badge pill SVGs. Returns a map of relative filename -> SVG string. */
export function renderBadges(names: readonly string[], themes: readonly Theme[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of names) {
    const found = ICON_INDEX.get(normalizeKey(name));
    // badge.ts applies its own per-theme contrast rule to the brand color.
    const icon: BadgeIcon | undefined = found ? { path: found.path, hex: `#${found.hex}` } : undefined;
    const stem = slug(name);
    for (const theme of themes) {
      out.set(`${stem}.${theme.id}.svg`, renderBadge(name, icon, theme));
    }
  }
  return out;
}
