/** Card geometry shared by the card renderers. */

import type { PaletteId } from './theme.js';

/** README column width measured on github.com profile pages (2026-07-22). */
export const CARD_WIDTH = 846;
export const CARD_PADDING = 24;
export const CARD_RADIUS = 12;
/** Inset panels (stat tiles) sit one step inside the card's curve. */
export const PANEL_RADIUS = 10;

/** Hue family for magnitude marks and chrome. Mirrors action.yml's `palette` default. */
export const DEFAULT_PALETTE: PaletteId = 'green';

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

/**
 * Whether a run writes one SVG per card or stacks every card into one SVG per
 * theme. Mirrors action.yml's `layout` default; "split" is what every release
 * before the input existed wrote.
 */
export const DEFAULT_LAYOUT: 'split' | 'combined' = 'split';

/**
 * File stem of the combined SVG (`cards.<theme>.svg`). No card carries this
 * name, so the combined file can never overwrite a split card's file.
 */
export const COMBINED_FILE_STEM = 'cards';
