/** GraphQL documents and their response shapes. */

import { range } from '../iter.js';

/**
 * Everything except calendars, in one cheap query (1 point, ~1.1k nodes).
 *
 * The per-repository scalars beyond `languages` — creation, size, license,
 * fork count, and the default branch's commit count — are what the portfolio
 * card draws. Measured live, adding all of them leaves the query at cost 1.
 *
 * `languages` asks for 30 per repository and reads `totalSize` alongside the
 * edges. The edge list is a truncation, so summing it alone understates the
 * total silently; `totalSize` minus the summed edges is the exact remainder,
 * which keeps the languages card's percentages honest however many languages a
 * repository turns out to hold.
 *
 * `pushedAt` is what bounds the commit sweep: it is an upper bound on every
 * commit date in the repository, so a repository last pushed before the sweep
 * window cannot hold a commit inside it.
 *
 * `privacy: PUBLIC` pins the repository-derived numbers (stars, languages,
 * repo count) to public data whatever token runs the generator. The flat
 * counters (pullRequests, issues, repositoriesContributedTo) are still
 * viewer-dependent — a PAT sees private items GITHUB_TOKEN cannot — so the
 * scheduled workflow is the canonical producer of committed assets; local
 * PAT runs are for inspection only.
 */
export const PROFILE_QUERY = `
query Profile($login: String!, $cursor: String) {
  user(login: $login) {
    id
    name
    followers { totalCount }
    mergedPullRequests: pullRequests(states: MERGED) { totalCount }
    issues { totalCount }
    repositoriesContributedTo(
      contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, PULL_REQUEST_REVIEW]
      includeUserRepositories: false
    ) { totalCount }
    contributionsCollection { contributionYears }
    repositories(
      ownerAffiliations: OWNER
      privacy: PUBLIC
      first: 100
      after: $cursor
      orderBy: { field: NAME, direction: ASC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        nameWithOwner
        isFork
        isArchived
        createdAt
        pushedAt
        diskUsage
        stargazerCount
        licenseInfo { spdxId }
        primaryLanguage { name color }
        defaultBranchRef { target { ... on Commit { history { totalCount } } } }
        languages(first: 30, orderBy: { field: SIZE, direction: DESC }) {
          totalSize
          edges { size node { name color } }
        }
      }
    }
  }
}`;

export interface ProfileQueryData {
  readonly user: {
    readonly id: string;
    readonly name: string | null;
    readonly followers: { readonly totalCount: number };
    readonly mergedPullRequests: { readonly totalCount: number };
    readonly issues: { readonly totalCount: number };
    readonly repositoriesContributedTo: { readonly totalCount: number };
    readonly contributionsCollection: { readonly contributionYears: readonly number[] };
    readonly repositories: {
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
      readonly nodes: readonly {
        readonly name: string;
        readonly nameWithOwner: string;
        readonly isFork: boolean;
        readonly isArchived: boolean;
        readonly createdAt: string;
        /** Last push to any branch; null for an empty repository. */
        readonly pushedAt: string | null;
        /** Size on disk in KB; null on a repository GitHub has not measured. */
        readonly diskUsage: number | null;
        readonly forkCount: number;
        readonly stargazerCount: number;
        readonly licenseInfo: { readonly spdxId: string | null } | null;
        readonly primaryLanguage: { readonly name: string; readonly color: string | null } | null;
        /** Null on an empty repository; otherwise every author's commits on the default branch. */
        readonly defaultBranchRef: {
          readonly target: { readonly history?: { readonly totalCount: number } } | null;
        } | null;
        readonly languages: {
          /** Bytes across every language, including any past the edge cap. */
          readonly totalSize: number;
          readonly edges: readonly {
            readonly size: number;
            readonly node: { readonly name: string; readonly color: string | null };
          }[];
        } | null;
      }[];
    };
  } | null;
}

/** One calendar year of contributions (the API caps windows at 1 year). */
export const YEAR_QUERY = `
query Year($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

export type ContributionLevelName =
  | 'NONE'
  | 'FIRST_QUARTILE'
  | 'SECOND_QUARTILE'
  | 'THIRD_QUARTILE'
  | 'FOURTH_QUARTILE';

export interface CalendarData {
  readonly totalContributions: number;
  readonly weeks: readonly {
    readonly contributionDays: readonly {
      readonly date: string;
      readonly contributionCount: number;
      readonly contributionLevel: ContributionLevelName;
    }[];
  }[];
}

export interface YearQueryData {
  readonly user: {
    readonly contributionsCollection: {
      readonly totalCommitContributions: number;
      readonly totalPullRequestContributions: number;
      readonly totalIssueContributions: number;
      readonly totalPullRequestReviewContributions: number;
      readonly restrictedContributionsCount: number;
      readonly contributionCalendar: CalendarData;
    };
  } | null;
}

/**
 * Trailing ~12 months (API default window) — the 3D graph's data plus the
 * per-repository commit ranking. `contributions.totalCount` counts commit
 * contributions (verified against live data), so the ranking needs no nested
 * pagination. `isPrivate` feeds the fetch-side privacy filter: a PAT can see
 * private repositories here, and their names must not reach a public card.
 * `primaryLanguage` and `stargazerCount` give each ranked row an identity
 * beyond its name — what it is written in, and whether anyone else uses it.
 *
 * `hasAnyRestrictedContributions` says whether the calendar totals count work
 * the viewer cannot see the details of. It follows the profile's "include
 * private contributions" setting, so it is the only way to tell a quiet year
 * from a private one.
 */
export const TRAILING_QUERY = `
query Trailing($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalRepositoriesWithContributedCommits
      hasAnyRestrictedContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
      commitContributionsByRepository(maxRepositories: 25) {
        repository {
          nameWithOwner
          isPrivate
          stargazerCount
          primaryLanguage { name color }
        }
        contributions(first: 1) { totalCount }
      }
      issueContributionsByRepository(maxRepositories: 25) {
        repository { nameWithOwner isPrivate }
        contributions(first: 1) { totalCount }
      }
      popularPullRequestContribution {
        pullRequest { title repository { nameWithOwner isPrivate } }
      }
    }
  }
}`;

export interface TrailingQueryData {
  readonly user: {
    readonly contributionsCollection: {
      readonly totalCommitContributions: number;
      readonly totalRepositoriesWithContributedCommits: number;
      readonly hasAnyRestrictedContributions: boolean;
      readonly contributionCalendar: CalendarData;
      readonly commitContributionsByRepository: readonly {
        readonly repository: {
          readonly nameWithOwner: string;
          readonly isPrivate: boolean;
          readonly stargazerCount: number;
          readonly primaryLanguage: { readonly name: string; readonly color: string | null } | null;
        };
        readonly contributions: { readonly totalCount: number };
      }[];
      readonly issueContributionsByRepository: readonly {
        readonly repository: { readonly nameWithOwner: string; readonly isPrivate: boolean };
        readonly contributions: { readonly totalCount: number };
      }[];
      /** Null when the window holds no pull request the API considers notable. */
      readonly popularPullRequestContribution: {
        readonly pullRequest: {
          readonly title: string;
          readonly repository: { readonly nameWithOwner: string; readonly isPrivate: boolean };
        };
      } | null;
    };
  } | null;
}

/**
 * Lifetime commits the user authored on each named repository's default branch.
 *
 * Built rather than declared, because one aliased selection per repository is
 * what keeps this to a single request: ten aliases measured at cost 1 with
 * nodeCount 0 against the live API, and the same shape resolves on
 * repositories the token has no relationship with.
 *
 * Aliases resolve independently, so a repository deleted or renamed since the
 * trailing query fails only its own alias — callers must tolerate NOT_FOUND.
 */
export function lifetimeCommitsQuery(count: number): string {
  const params = range(count)
    .map((index) => `$o${index}: String!, $n${index}: String!`)
    .join(', ');
  const selections = range(count)
    .map(
      (index) =>
        `  r${index}: repository(owner: $o${index}, name: $n${index}) {` +
        ` defaultBranchRef { target { ... on Commit { history(author: { id: $authorId }) { totalCount } } } } }`
    )
    .join('\n');
  return `query LifetimeCommits($authorId: ID!, ${params}) {\n${selections}\n}`;
}

/** Alias -> that repository's lifetime commit count, or null when it vanished. */
export type LifetimeCommitsQueryData = Record<
  string,
  {
    readonly defaultBranchRef: {
      readonly target: { readonly history?: { readonly totalCount: number } } | null;
    } | null;
  } | null
>;

/**
 * One page of commits the user authored on a repository's default branch.
 *
 * `changedFilesIfAvailable` is what turns a line count into a rate: lines per
 * commit says little on its own, while lines per file separates a hand edit
 * from a regenerated bundle. It is nullable because GitHub computes the diff
 * lazily, so every consumer has to tolerate its absence.
 *
 * `author { date }` is a GitTimestamp: unlike DateTime it keeps the author's
 * UTC offset, which is what lets the cadence card bucket by the author's own
 * clock. `authoredDate`/`committedDate` are DateTime (UTC-normalized) and must
 * not be used here.
 */
export const COMMITS_QUERY = `
query Commits($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(author: { id: $authorId }, since: $since, first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { author { date } additions deletions changedFilesIfAvailable }
          }
        }
      }
    }
  }
}`;

export interface CommitsQueryData {
  readonly repository: {
    readonly defaultBranchRef: {
      readonly target: {
        /** Absent when the ref points at a non-commit object. */
        readonly history?: {
          readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
          readonly nodes: readonly {
            readonly author: { readonly date: string | null } | null;
            readonly additions: number;
            readonly deletions: number;
            /** Null when GitHub has not computed the diff for this commit. */
            readonly changedFilesIfAvailable: number | null;
          }[];
        };
      } | null;
    } | null;
  } | null;
}
