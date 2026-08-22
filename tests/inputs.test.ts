import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readInputs } from '../src/inputs.js';

vi.mock('@actions/core');

const getInputMock = vi.mocked(core.getInput);
const getMultilineInputMock = vi.mocked(core.getMultilineInput);
const getBooleanInputMock = vi.mocked(core.getBooleanInput);

/** Drive the mocked @actions/core input readers from a plain name->value map. */
function setInputs(values: Record<string, string>): void {
  getInputMock.mockImplementation((name: string) => values[name] ?? '');
  getBooleanInputMock.mockImplementation((name: string) => (values[name] ?? '').toLowerCase() === 'true');
  getMultilineInputMock.mockImplementation((name: string) => {
    const raw = values[name] ?? '';
    return raw === '' ? [] : raw.split('\n');
  });
}

const VALID_INPUTS: Record<string, string> = {
  'github-token': 'ghp_secret',
  username: 'octocat',
  cards: 'overview,lifetime,contributions,composition,rhythm,languages',
  'output-dir': 'assets',
  themes: 'light,dark',
  font: 'Roboto',
  'mono-font': 'Roboto Mono',
  badges: '',
  commit: 'true',
  'commit-message': 'chore(profile): refresh generated cards [skip ci]',
};

describe('readInputs', () => {
  const originalOwner = process.env['GITHUB_REPOSITORY_OWNER'];

  beforeEach(() => {
    delete process.env['GITHUB_REPOSITORY_OWNER'];
  });

  afterEach(() => {
    if (originalOwner === undefined) {
      delete process.env['GITHUB_REPOSITORY_OWNER'];
    } else {
      process.env['GITHUB_REPOSITORY_OWNER'] = originalOwner;
    }
  });

  it('should parse a fully-specified, valid input set', () => {
    setInputs(VALID_INPUTS);
    expect(readInputs()).toEqual({
      token: 'ghp_secret',
      username: 'octocat',
      cards: ['overview', 'lifetime', 'contributions', 'composition', 'rhythm', 'languages'],
      outputDir: 'assets',
      themeIds: ['light', 'dark'],
      font: 'Roboto',
      monoFont: 'Roboto Mono',
      badges: [],
      commit: true,
      commitMessage: 'chore(profile): refresh generated cards [skip ci]',
    });
  });

  it('should fall back to documented defaults when inputs are empty', () => {
    setInputs({ 'github-token': 'ghp_secret', username: 'octocat' });
    const inputs = readInputs();
    expect(inputs.cards).toEqual([
      'overview',
      'lifetime',
      'contributions',
      'composition',
      'rhythm',
      'cadence',
      'languages',
    ]);
    expect(inputs.themeIds).toEqual(['light', 'dark']);
    expect(inputs.outputDir).toBe('assets');
    expect(inputs.font).toBe('Roboto');
    expect(inputs.monoFont).toBe('Roboto Mono');
    expect(inputs.commit).toBe(true);
    expect(inputs.commitMessage).toBe('chore(profile): refresh generated cards [skip ci]');
  });

  it('should lowercase, dedupe, and preserve card order', () => {
    setInputs({ ...VALID_INPUTS, cards: 'Languages, overview\nlanguages  rhythm' });
    expect(readInputs().cards).toEqual(['languages', 'overview', 'rhythm']);
  });

  it('should reject an unknown card', () => {
    setInputs({ ...VALID_INPUTS, cards: 'overview,bogus' });
    expect(() => readInputs()).toThrow(
      'Unknown card "bogus". Valid: overview, lifetime, contributions, composition, rhythm, cadence, languages.'
    );
  });

  it('should reject an unknown theme', () => {
    setInputs({ ...VALID_INPUTS, themes: 'light,purple' });
    expect(() => readInputs()).toThrow('Unknown theme "purple". Valid: light, dark.');
  });

  it('should dedupe and preserve theme order', () => {
    setInputs({ ...VALID_INPUTS, themes: 'dark light dark' });
    expect(readInputs().themeIds).toEqual(['dark', 'light']);
  });

  it('should fall back to GITHUB_REPOSITORY_OWNER when username is empty', () => {
    process.env['GITHUB_REPOSITORY_OWNER'] = 'env-owner';
    setInputs({ ...VALID_INPUTS, username: '' });
    expect(readInputs().username).toBe('env-owner');
  });

  it('should throw when username is empty and no owner is set', () => {
    setInputs({ ...VALID_INPUTS, username: '' });
    expect(() => readInputs()).toThrow(/GITHUB_REPOSITORY_OWNER/);
  });

  it('should parse badges: trim, drop empties, preserve order', () => {
    setInputs({ ...VALID_INPUTS, badges: '  React  \n\n  Vue \n   \nTypeScript' });
    expect(readInputs().badges).toEqual(['React', 'Vue', 'TypeScript']);
  });

  it('should read commit=false as a boolean', () => {
    setInputs({ ...VALID_INPUTS, commit: 'false' });
    expect(readInputs().commit).toBe(false);
  });

  it('should default commit to true when the input is empty', () => {
    setInputs({ ...VALID_INPUTS, commit: '' });
    expect(readInputs().commit).toBe(true);
  });
});
