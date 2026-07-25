/**
 * Dev-time example gallery build.
 *
 * Render every card and a representative badge set from a live GitHub profile
 * into examples/, so the README can show real output instead of prose. The
 * pipeline is the action's own (src/main.ts) minus the @actions/core plumbing:
 * fetch -> compute -> resolve fonts -> render -> write. This script is the local
 * entry point; CI refreshes the same gallery by running the action itself
 * (`uses: ./` in .github/workflows/examples.yml). Never runs at action runtime.
 *
 * Usage: GITHUB_TOKEN=$(gh auth token) pnpm run examples
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import type { ProfileData } from '../src/model.js';

/**
 * Map relative `.js` import specifiers onto their `.ts` sources.
 *
 * src/ is written with the `.js` specifiers tsdown expects, but no build output
 * exists when this script runs under Node's type stripping, so every internal
 * import inside the src graph would fail to resolve. Hooks only affect modules
 * loaded after registration, which is why the src imports below are dynamic —
 * static imports are resolved before any statement runs.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL !== undefined) {
      const source = new URL(`${specifier.slice(0, -'.js'.length)}.ts`, context.parentURL);
      if (existsSync(source)) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const [{ renderBadges }, { renderCard }, { computeStreaks }, { resolveFonts }, { fetchProfile }, { DARK, LIGHT }] =
  await Promise.all([
    import('../src/badges.js'),
    import('../src/cards.js'),
    import('../src/compute/streaks.js'),
    import('../src/fonts.js'),
    import('../src/github/fetch-profile.js'),
    import('../src/theme.js'),
  ]);

const token = process.env['GITHUB_TOKEN'];
if (token === undefined || token.trim() === '') {
  console.error('GITHUB_TOKEN is required. Example: GITHUB_TOKEN=$(gh auth token) pnpm run examples');
  process.exit(1);
}

const login = process.env['EXAMPLES_LOGIN'] ?? 'seijikohara';

const CARDS: readonly string[] = ['overview', 'lifetime', 'contributions', 'composition', 'rhythm', 'languages'];

// Three brands simple-icons carries plus one it does not, so the gallery shows
// both pill shapes: with a glyph and text-only.
const BADGES: readonly string[] = ['GitHub', 'TypeScript', 'npm', 'Findy'];

// The bundled families, matching the action's `font` / `mono-font` defaults.
// Resolving them needs no network.
const SANS_FAMILY = 'Roboto';
const MONO_FAMILY = 'Roboto Mono';

const outDir = join(import.meta.dirname, '..', 'examples');

const readme = [
  '# Generated examples',
  '',
  `The SVGs in this directory are rendered by this action from the live GitHub profile of [@${login}](https://github.com/${login})`,
  'and are embedded in the repository README.',
  '',
  '[`.github/workflows/examples.yml`](../.github/workflows/examples.yml) refreshes them automatically, so **do not edit',
  'them by hand** — the next run overwrites every one of them.',
  '',
  'To regenerate them locally, run:',
  '',
  '```sh',
  'GITHUB_TOKEN=$(gh auth token) pnpm run examples',
  '```',
  '',
].join('\n');

const fetched = await fetchProfile(token, login);
const data: ProfileData = { ...fetched, generatedAt: new Date().toISOString() };
const streaks = computeStreaks(data.lifetimeDays);
const fontFaceCss = await resolveFonts(SANS_FAMILY, MONO_FAMILY);
const themes = [LIGHT, DARK];

// Relative path -> SVG, in the same layout the action writes: cards at the root
// of the output directory, badges under `badges/`.
const files = new Map<string, string>();
for (const theme of themes) {
  for (const card of CARDS) {
    files.set(`${card}.${theme.id}.svg`, renderCard(card, data, streaks, theme, fontFaceCss));
  }
}
for (const [name, svg] of renderBadges(BADGES, themes)) {
  files.set(join('badges', name), svg);
}

for (const [rel, svg] of files) {
  const path = join(outDir, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${svg}\n`, 'utf8');
  console.log(`wrote ${rel}`);
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'README.md'), readme, 'utf8');
console.log('wrote README.md');

console.log(
  `Generated ${files.size} SVGs plus README.md for @${login} in ${outDir} ` +
    `(${CARDS.length} cards x ${themes.length} themes, ${BADGES.length} badges)`
);
