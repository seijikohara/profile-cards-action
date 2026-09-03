/** Read and validate the action's inputs into a typed configuration object. */

import * as core from '@actions/core';
import { DEFAULT_LANGUAGE_LIMIT } from './config.js';

/** Theme identifier accepted by the `themes` input. */
type ThemeId = 'light' | 'dark';

/** Resolved, validated action configuration. */
export interface ActionInputs {
  readonly token: string;
  /** GitHub login to render (never empty). */
  readonly username: string;
  /** Cards to render, in request order, deduped and validated. */
  readonly cards: readonly string[];
  readonly outputDir: string;
  /** Themes to render, deduped and validated. */
  readonly themeIds: readonly ('light' | 'dark')[];
  readonly font: string;
  readonly monoFont: string;
  /** Languages the languages card lists before the rest fold into "Other" (>= 1). */
  readonly languageLimit: number;
  /** Badge brand names, trimmed and non-empty. */
  readonly badges: readonly string[];
  readonly commit: boolean;
  readonly commitMessage: string;
}

/** Cards the renderer knows how to draw. */
const KNOWN_CARDS: readonly string[] = [
  'overview',
  'lifetime',
  'contributions',
  'composition',
  'rhythm',
  'cadence',
  'repositories',
  'languages',
];

const THEME_IDS: readonly ThemeId[] = ['light', 'dark'];

// Fallbacks that mirror action.yml so the code stays correct even when an input
// arrives empty (e.g. invoked outside the action's default resolution).
const DEFAULT_CARDS = KNOWN_CARDS.join(',');
const DEFAULT_THEMES = 'light,dark';
const DEFAULT_OUTPUT_DIR = 'assets';
const DEFAULT_FONT = 'Roboto';
const DEFAULT_MONO_FONT = 'Roboto Mono';
const DEFAULT_COMMIT_MESSAGE = 'chore(profile): refresh generated cards [skip ci]';

/** Split on commas and any whitespace (including newlines), dropping empties. */
function tokenize(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0);
}

/** Parse the `cards` input: lowercase, deduped, order-preserving, validated. */
function parseCards(raw: string): string[] {
  const tokens = tokenize(raw.trim() || DEFAULT_CARDS);
  const seen = new Set<string>();
  const cards: string[] = [];
  for (const token of tokens) {
    if (!KNOWN_CARDS.includes(token)) {
      throw new Error(`Unknown card "${token}". Valid: ${KNOWN_CARDS.join(', ')}.`);
    }
    if (!seen.has(token)) {
      seen.add(token);
      cards.push(token);
    }
  }
  return cards;
}

/** Parse the `themes` input: lowercase, deduped, order-preserving, validated. */
function parseThemes(raw: string): ThemeId[] {
  const tokens = tokenize(raw.trim() || DEFAULT_THEMES);
  const seen = new Set<string>();
  const themes: ThemeId[] = [];
  for (const token of tokens) {
    if (token !== 'light' && token !== 'dark') {
      throw new Error(`Unknown theme "${token}". Valid: ${THEME_IDS.join(', ')}.`);
    }
    if (!seen.has(token)) {
      seen.add(token);
      themes.push(token);
    }
  }
  return themes;
}

/** Parse `language-limit`: a positive integer, or the default when empty. */
function parseLanguageLimit(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_LANGUAGE_LIMIT;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid language-limit "${trimmed}". Expected a positive integer.`);
  }
  return value;
}

/** Resolve the login, falling back to the repository owner. */
function resolveUsername(raw: string): string {
  const username = raw.trim() || process.env['GITHUB_REPOSITORY_OWNER'] || '';
  if (username === '') {
    throw new Error('No username provided and GITHUB_REPOSITORY_OWNER is unset; set the "username" input.');
  }
  return username;
}

/** Read `commit`, tolerating an empty value by falling back to the default. */
function readCommit(): boolean {
  // getBooleanInput throws on an empty (non-YAML-boolean) value, so gate it.
  if (core.getInput('commit').trim() === '') {
    return true;
  }
  return core.getBooleanInput('commit');
}

/** Read every action input and return the validated configuration. */
export function readInputs(): ActionInputs {
  const token = core.getInput('github-token', { required: true });
  const username = resolveUsername(core.getInput('username'));
  const cards = parseCards(core.getInput('cards'));
  const outputDir = core.getInput('output-dir').trim() || DEFAULT_OUTPUT_DIR;
  const themeIds = parseThemes(core.getInput('themes'));
  const font = core.getInput('font').trim() || DEFAULT_FONT;
  const monoFont = core.getInput('mono-font').trim() || DEFAULT_MONO_FONT;
  const languageLimit = parseLanguageLimit(core.getInput('language-limit'));
  const badges = core
    .getMultilineInput('badges')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const commit = readCommit();
  const commitMessage = core.getInput('commit-message').trim() || DEFAULT_COMMIT_MESSAGE;

  return {
    token,
    username,
    cards,
    outputDir,
    themeIds,
    font,
    monoFont,
    languageLimit,
    badges,
    commit,
    commitMessage,
  };
}
