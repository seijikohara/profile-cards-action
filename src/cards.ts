/** @fileoverview Dispatch a card name to its renderer and place the result in an SVG document. */

import { DEFAULT_LANGUAGE_LIMIT, DEFAULT_LEGEND } from './config.js';
import type { ProfileData, Streaks } from './model.js';
import type { Theme } from './theme.js';
import { renderCadence } from './cards/cadence.js';
import { renderComposition } from './cards/composition.js';
import { renderContributions } from './cards/contributions.js';
import { type Card, cardSvg, combinedSvg } from './cards/frame.js';
import { renderLanguages } from './cards/languages.js';
import { renderLifetime } from './cards/lifetime.js';
import { renderMomentum } from './cards/momentum.js';
import { renderOverview } from './cards/overview.js';
import { renderPortfolio } from './cards/portfolio.js';
import { renderRepositories } from './cards/repositories.js';
import { renderRhythm } from './cards/rhythm.js';

/** How a card labels the magnitude ramp it draws. */
export type LegendStyle = 'ramp' | 'scale';

/** Whether a run writes one SVG per card or stacks every card into one SVG. */
export type CardLayout = 'split' | 'combined';

/** Render settings that come from action inputs rather than from the API. */
export interface CardOptions {
  /** Languages the languages card lists before the rest fold into "Other". */
  readonly languageLimit: number;
  /** "ramp" keeps Less…More; "scale" names the value band each step covers. */
  readonly legend: LegendStyle;
}

export const DEFAULT_CARD_OPTIONS: CardOptions = { languageLimit: DEFAULT_LANGUAGE_LIMIT, legend: DEFAULT_LEGEND };

/** Build one card by id, before it is placed in a document. */
function buildCard(card: string, data: ProfileData, streaks: Streaks, theme: Theme, options: CardOptions): Card {
  switch (card) {
    case 'overview':
      return renderOverview(data, theme);
    case 'lifetime':
      return renderLifetime(data, theme, options.legend);
    case 'contributions':
      return renderContributions(data, streaks, theme, options.legend);
    case 'momentum':
      return renderMomentum(data, theme);
    case 'composition':
      return renderComposition(data, theme);
    case 'rhythm':
      return renderRhythm(data, theme);
    case 'cadence':
      return renderCadence(data, theme, options.legend);
    case 'repositories':
      return renderRepositories(data, theme);
    case 'portfolio':
      return renderPortfolio(data, theme);
    case 'languages':
      return renderLanguages(data, theme, options.languageLimit);
    default:
      throw new Error(`Unknown card: ${card}`);
  }
}

/** Render one card by id. `fontFaceCss` is the resolved @font-face block embedded in the document. */
export function renderCard(
  card: string,
  data: ProfileData,
  streaks: Streaks,
  theme: Theme,
  fontFaceCss: string,
  options: CardOptions = DEFAULT_CARD_OPTIONS
): string {
  return cardSvg(buildCard(card, data, streaks, theme, options), fontFaceCss);
}

/** Render several cards as one SVG, stacked top to bottom in the order given. */
export function renderCombined(
  cards: readonly string[],
  data: ProfileData,
  streaks: Streaks,
  theme: Theme,
  fontFaceCss: string,
  options: CardOptions = DEFAULT_CARD_OPTIONS
): string {
  return combinedSvg(
    cards.map((card) => buildCard(card, data, streaks, theme, options)),
    fontFaceCss
  );
}
