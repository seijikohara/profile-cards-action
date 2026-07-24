/**
 * @fileoverview Action entry point.
 *
 * Read inputs -> fetch the profile via GraphQL -> compute -> resolve fonts ->
 * render the selected cards (and any badges) -> write to the output directory ->
 * optionally commit and push -> set outputs.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as core from '@actions/core';
import { renderBadges } from './badges.js';
import { renderCard } from './cards.js';
import { computeStreaks } from './compute/streaks.js';
import { resolveFonts } from './fonts.js';
import { fetchProfile } from './github/fetch-profile.js';
import { changedPaths, commitAndPush } from './git.js';
import { readInputs } from './inputs.js';
import type { ProfileData } from './model.js';
import { DARK, LIGHT, type Theme } from './theme.js';

const THEME_BY_ID: Record<'light' | 'dark', Theme> = { light: LIGHT, dark: DARK };

async function run(): Promise<void> {
  const inputs = readInputs();
  // Mask the token so no later log line can accidentally surface it.
  core.setSecret(inputs.token);

  const fetched = await fetchProfile(inputs.token, inputs.username);
  const data: ProfileData = { ...fetched, generatedAt: new Date().toISOString() };
  const streaks = computeStreaks(data.lifetimeDays);
  const fontFaceCss = await resolveFonts(inputs.font, inputs.monoFont);
  const themes = inputs.themeIds.map((id) => THEME_BY_ID[id]);

  // Relative path -> SVG. Cards first, then badges under `badges/`.
  const files = new Map<string, string>();
  for (const theme of themes) {
    for (const card of inputs.cards) {
      files.set(`${card}.${theme.id}.svg`, renderCard(card, data, streaks, theme, fontFaceCss));
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
      `(${inputs.cards.length} cards x ${themes.length} themes, ${inputs.badges.length} badges)`
  );

  let changed: boolean;
  if (inputs.commit) {
    const result = await commitAndPush({
      dir: inputs.outputDir,
      message: inputs.commitMessage,
      token: inputs.token,
    });
    changed = result.changed;
    core.info(result.changed ? `Committed ${result.files.length} changed files` : 'No changes to commit');
  } else {
    changed = (await changedPaths(inputs.outputDir)).length > 0;
  }

  core.setOutput('changed', String(changed));
  core.setOutput('files', JSON.stringify(written));
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
