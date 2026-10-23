/**
 * @fileoverview Action entry point.
 *
 * Read inputs -> fetch the profile via GraphQL -> compute -> resolve fonts ->
 * render the selected cards, one file each or stacked into one (and any badges)
 * -> write to the output directory -> optionally commit and push -> set outputs.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as core from '@actions/core';
import { renderBadges } from './badges.js';
import { renderCard, renderCombined } from './cards.js';
import { computeStreaks } from './compute/streaks.js';
import { COMBINED_FILE_STEM } from './config.js';
import { resolveFonts } from './fonts.js';
import { fetchProfile } from './github/fetch-profile.js';
import { changedPaths, commitAndPush } from './git.js';
import { readInputs, type ActionInputs } from './inputs.js';
import type { ProfileData } from './model.js';
import { themeFor } from './theme.js';

/** Commit when asked, otherwise just detect pending changes — either way report whether anything changed. */
async function resolveChanged(inputs: ActionInputs): Promise<boolean> {
  if (!inputs.commit) return (await changedPaths(inputs.outputDir)).length > 0;
  const result = await commitAndPush({ dir: inputs.outputDir, message: inputs.commitMessage, token: inputs.token });
  core.info(result.changed ? `Committed ${result.files.length} changed files` : 'No changes to commit');
  return result.changed;
}

async function run(): Promise<void> {
  const inputs = readInputs();
  // Mask the token so no later log line can accidentally surface it.
  core.setSecret(inputs.token);

  // The commit sweep is the only per-repository query in a run; it feeds the
  // cadence card alone, so a card list without it skips the cost entirely.
  const fetched = await fetchProfile(inputs.token, inputs.username, {
    sweepCommits: inputs.cards.includes('cadence'),
    sweepLimit: inputs.commitSweepLimit,
  });
  const data: ProfileData = { ...fetched, generatedAt: new Date().toISOString() };
  const streaks = computeStreaks(data.lifetimeDays);
  const fontFaceCss = await resolveFonts(inputs.font, inputs.monoFont);
  const themes = inputs.themeIds.map((id) => themeFor(id, inputs.palette));

  const options = { languageLimit: inputs.languageLimit, legend: inputs.legend };

  // Relative path -> SVG. Cards first, then badges under `badges/`.
  const files = new Map<string, string>();
  for (const theme of themes) {
    if (inputs.layout === 'combined') {
      files.set(
        `${COMBINED_FILE_STEM}.${theme.id}.svg`,
        renderCombined(inputs.cards, data, streaks, theme, fontFaceCss, options)
      );
    } else {
      for (const card of inputs.cards) {
        files.set(`${card}.${theme.id}.svg`, renderCard(card, data, streaks, theme, fontFaceCss, options));
      }
    }
  }
  for (const [name, svg] of renderBadges(inputs.badges, themes)) {
    files.set(join('badges', name), svg);
  }

  const written: string[] = [];
  for (const [rel, svg] of files) {
    const path = join(inputs.outputDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${svg}\n`, 'utf8');
    written.push(path);
  }
  core.info(
    `Generated ${written.length} files for @${data.login} in ${inputs.outputDir} ` +
      `(${inputs.cards.length} cards ${inputs.layout} x ${themes.length} themes, ${inputs.badges.length} badges)`
  );

  const changed = await resolveChanged(inputs);

  core.setOutput('changed', String(changed));
  core.setOutput('files', JSON.stringify(written));
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
