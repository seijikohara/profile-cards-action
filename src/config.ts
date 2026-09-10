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

/**
 * How the magnitude ramp is labelled. Mirrors action.yml's `legend` default:
 * "ramp" keeps the calendar's familiar Less…More, "scale" prints the counts
 * each step stands for.
 */
export const DEFAULT_LEGEND: 'ramp' | 'scale' = 'ramp';

/**
 * Repositories the trailing-year commit sweep visits, most recently pushed
 * first. Mirrors action.yml's `commit-sweep-limit` default; 0 means every
 * repository that could hold a commit in the window.
 */
export const DEFAULT_COMMIT_SWEEP_LIMIT = 0;
