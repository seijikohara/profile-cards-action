/** Ranking of repositories by trailing-year commit contributions. */

import type { RepoCommits } from '../model.js';

/** Rows shown on the repositories card — the bar scale needs the maximum. */
export interface RepositoriesData {
  /** At most 10 rows, commits descending, name ascending on ties. */
  readonly rows: readonly RepoCommits[];
  /** Greatest commit count across rows; 0 when there are none. */
  readonly max: number;
}

const MAX_ROWS = 10;

/** Sort, drop empty entries, and cap the ranking for the card. */
export function computeRepositories(repos: readonly RepoCommits[]): RepositoriesData {
  const rows = repos
    .filter((repo) => repo.commits > 0)
    .toSorted((a, b) => b.commits - a.commits || a.nameWithOwner.localeCompare(b.nameWithOwner))
    .slice(0, MAX_ROWS);
  return { rows, max: rows[0]?.commits ?? 0 };
}
