import { describe, expect, it } from 'vitest';
import { computeRepositories } from '../src/compute/repositories.js';
import type { RepoCommits } from '../src/model.js';

function repo(nameWithOwner: string, commits: number): RepoCommits {
  return { nameWithOwner, commits, language: null, stars: 0 };
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
