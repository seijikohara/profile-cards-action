/** @fileoverview Dispatch a card name to its renderer, threading the resolved font CSS. */

import { DEFAULT_LANGUAGE_LIMIT } from './config.js';
import type { ProfileData, Streaks } from './model.js';
import type { Theme } from './theme.js';
import { renderCadence } from './cards/cadence.js';
import { renderComposition } from './cards/composition.js';
import { renderContributions } from './cards/contributions.js';
import { renderLanguages } from './cards/languages.js';
import { renderLifetime } from './cards/lifetime.js';
import { renderOverview } from './cards/overview.js';
import { renderRepositories } from './cards/repositories.js';
import { renderRhythm } from './cards/rhythm.js';

/** Render settings that come from action inputs rather than from the API. */
export interface CardOptions {
  /** Languages the languages card lists before the rest fold into "Other". */
  readonly languageLimit: number;
}

export const DEFAULT_CARD_OPTIONS: CardOptions = { languageLimit: DEFAULT_LANGUAGE_LIMIT };

/** Render one card by id. `fontFaceCss` is the resolved @font-face block injected into the frame. */
export function renderCard(
  card: string,
  data: ProfileData,
  streaks: Streaks,
  theme: Theme,
  fontFaceCss: string,
  options: CardOptions = DEFAULT_CARD_OPTIONS
): string {
  switch (card) {
    case 'overview':
      return renderOverview(data, theme, fontFaceCss);
    case 'lifetime':
      return renderLifetime(data, theme, fontFaceCss);
    case 'contributions':
      return renderContributions(data, streaks, theme, fontFaceCss);
    case 'composition':
      return renderComposition(data, theme, fontFaceCss);
    case 'rhythm':
      return renderRhythm(data, theme, fontFaceCss);
    case 'cadence':
      return renderCadence(data, theme, fontFaceCss);
    case 'repositories':
      return renderRepositories(data, theme, fontFaceCss);
    case 'languages':
      return renderLanguages(data, theme, fontFaceCss, options.languageLimit);
    default:
      throw new Error(`Unknown card: ${card}`);
  }
}
