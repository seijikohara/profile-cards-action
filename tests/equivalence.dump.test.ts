/** Temporary: hash every card render from the fixture for refactor equivalence. */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { renderCard } from '../src/cards.js';
import { computeStreaks } from '../src/compute/streaks.js';
import { resolveFonts } from '../src/fonts.js';
import { THEMES } from '../src/theme.js';
import { makeFixture } from './fixture.js';

const CARDS = [
  'overview',
  'lifetime',
  'contributions',
  'composition',
  'rhythm',
  'cadence',
  'repositories',
  'languages',
];
const OUT = process.env['EQUIV_OUT'];

it.runIf(OUT !== undefined)('dumps render hashes', async () => {
  if (OUT === undefined) return; // narrows for TS; runIf already guards execution
  const data = makeFixture();
  const streaks = computeStreaks(data.lifetimeDays);
  const fontFaceCss = await resolveFonts('Roboto', 'Roboto Mono');
  const hashes = Object.fromEntries(
    THEMES.flatMap((theme) =>
      CARDS.map((card) => [
        `${card}.${theme.id}`,
        createHash('sha256')
          .update(renderCard(card, data, streaks, theme, fontFaceCss))
          .digest('hex'),
      ])
    )
  );
  writeFileSync(
    OUT,
    JSON.stringify({ ...hashes, streaks: createHash('sha256').update(JSON.stringify(streaks)).digest('hex') }, null, 2)
  );
});
