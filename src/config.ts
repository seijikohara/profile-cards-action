/** Card geometry shared by the card renderers. */

/** README column width measured on github.com profile pages (2026-07-22). */
export const CARD_WIDTH = 846;
export const CARD_PADDING = 24;
export const CARD_RADIUS = 6;

/**
 * Languages the languages card lists before the rest fold into "Other".
 * Mirrors action.yml's `language-limit` default; the card grows a row per
 * language, so raising it costs card height, not layout.
 */
export const DEFAULT_LANGUAGE_LIMIT = 8;
