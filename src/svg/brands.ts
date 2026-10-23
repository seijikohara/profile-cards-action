/**
 * simple-icons lookup shared by the badges and the language marks.
 *
 * The package is bundled whole: badge names are free-form, so every glyph must
 * stay reachable at runtime and tree-shaking cannot help.
 */

import * as simpleIcons from 'simple-icons';

/** Minimal shape consumed here; simple-icons objects carry more (svg, source, license). */
export interface BrandIcon {
  readonly title: string;
  readonly slug: string;
  /** 24x24 viewBox path data. */
  readonly path: string;
  /** Brand color without the leading '#'. */
  readonly hex: string;
}

/**
 * Narrow an arbitrary module export to an icon object.
 *
 * Guards against non-icon exports (helper functions in some releases) so the
 * index only ever holds renderable glyphs.
 */
function isIcon(value: unknown): value is BrandIcon {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BrandIcon>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.hex === 'string'
  );
}

/** Reduce a name to its icon-lookup key: lowercase, drop every non-alphanumeric char. */
export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ICONS: readonly BrandIcon[] = Object.values(simpleIcons).filter(isIcon);

/**
 * Every glyph by the normalized form of both its title and its slug. Earlier
 * entries win on key collision to keep the mapping deterministic across the
 * fixed export order.
 */
const BY_NAME: ReadonlyMap<string, BrandIcon> = (() => {
  const index = new Map<string, BrandIcon>();
  for (const icon of ICONS) {
    for (const key of [normalizeKey(icon.title), normalizeKey(icon.slug)]) {
      if (key !== '' && !index.has(key)) index.set(key, icon);
    }
  }
  return index;
})();

const BY_SLUG: ReadonlyMap<string, BrandIcon> = new Map(ICONS.map((icon) => [icon.slug, icon]));

/** Find a glyph by free-form display name (badges). */
export function findBrand(name: string): BrandIcon | undefined {
  return BY_NAME.get(normalizeKey(name));
}

/** Find a glyph by its exact simple-icons slug. */
export function brandBySlug(slug: string): BrandIcon | undefined {
  return BY_SLUG.get(slug);
}
