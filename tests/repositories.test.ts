import { describe, expect, it } from 'vitest';
import { renderRepositories } from '../src/cards/repositories.js';
import { computeRepositories } from '../src/compute/repositories.js';
import type { ProfileData, RepoCommits } from '../src/model.js';
import { LIGHT } from '../src/theme.js';
import { makeFixture } from './fixture.js';
import { assertWellFormed } from './xml.js';

function repo(nameWithOwner: string, commits: number): RepoCommits {
  return { nameWithOwner, commits, issues: 0, lifetimeCommits: commits, language: null, stars: 0 };
}

describe('computeRepositories', () => {
  it('sorts by commits descending', () => {
    const result = computeRepositories([repo('a/low', 3), repo('b/high', 90), repo('c/mid', 40)]);
    expect(result.rows.map((row) => row.nameWithOwner)).toEqual(['b/high', 'c/mid', 'a/low']);
    expect(result.max).toBe(90);
  });

  it('breaks ties by name for deterministic output', () => {
    const result = computeRepositories([repo('b/beta', 5), repo('a/alpha', 5)]);
    expect(result.rows.map((row) => row.nameWithOwner)).toEqual(['a/alpha', 'b/beta']);
  });

  it('caps the ranking at 10 rows', () => {
    const many = Array.from({ length: 14 }, (_, index) => repo(`o/repo-${String(index).padStart(2, '0')}`, index + 1));
    const result = computeRepositories(many);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]?.commits).toBe(14);
    expect(result.rows[9]?.commits).toBe(5);
  });

  it('drops zero-commit entries', () => {
    const result = computeRepositories([repo('a/active', 2), repo('b/idle', 0)]);
    expect(result.rows.map((row) => row.nameWithOwner)).toEqual(['a/active']);
  });

  it('handles an empty list', () => {
    const result = computeRepositories([]);
    expect(result.rows).toEqual([]);
    expect(result.max).toBe(0);
  });
});

describe('renderRepositories depth', () => {
  const data: ProfileData = makeFixture();

  it('draws a track behind a bar whose repository has deeper history', () => {
    const svg = renderRepositories(data, LIGHT, '');
    assertWellFormed(svg);
    // vizel: 379 of 540 lifetime commits.
    expect(svg).toContain('>379 / 540<');
  });

  it('prints one number where the lifetime count adds nothing', () => {
    const single: ProfileData = {
      ...data,
      topRepositories: [
        { nameWithOwner: 'a/one', commits: 50, issues: 0, lifetimeCommits: 50, language: null, stars: 0 },
      ],
    };
    const svg = renderRepositories(single, LIGHT, '');
    expect(svg).toContain('>50<');
    expect(svg).not.toContain('50 / 50');
  });

  it('clamps a bar that outruns its own track', () => {
    // Commits on non-default branches are counted by the trailing query and not
    // by the lifetime one, so the trailing figure can be the larger.
    const branchy: ProfileData = {
      ...data,
      topRepositories: [
        { nameWithOwner: 'a/branchy', commits: 90, issues: 0, lifetimeCommits: 10, language: null, stars: 0 },
      ],
    };
    const svg = renderRepositories(branchy, LIGHT, '');
    assertWellFormed(svg);
    expect(svg).toContain('>90<');
  });

  it('names the issues column in the key', () => {
    expect(renderRepositories(data, LIGHT, '')).toContain('>issues opened<');
  });

  it('surfaces the most discussed pull request, and degrades without one', () => {
    expect(renderRepositories(data, LIGHT, '')).toContain('MOST DISCUSSED PR · kovidgoyal/kitty · Add mouse');
    expect(renderRepositories({ ...data, popularPullRequest: null }, LIGHT, '')).not.toContain('MOST DISCUSSED PR');
  });
});
