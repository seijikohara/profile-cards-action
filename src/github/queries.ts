/** GraphQL documents and their response shapes. */

/**
 * Everything except calendars, in one cheap query (1 point, ~1.1k nodes).
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
        isFork
        isArchived
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

export interface ProfileQueryData {
  readonly user: {
    readonly name: string | null;
    readonly followers: { readonly totalCount: number };
    readonly mergedPullRequests: { readonly totalCount: number };
    readonly issues: { readonly totalCount: number };
    readonly repositoriesContributedTo: { readonly totalCount: number };
    readonly contributionsCollection: { readonly contributionYears: readonly number[] };
    readonly repositories: {
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
      readonly nodes: readonly {
        readonly isFork: boolean;
        readonly isArchived: boolean;
        readonly stargazerCount: number;
        readonly languages: {
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

/** Trailing ~12 months (API default window) — the 3D graph's data. */
export const TRAILING_QUERY = `
query Trailing($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

export interface TrailingQueryData {
  readonly user: {
    readonly contributionsCollection: {
      readonly contributionCalendar: CalendarData;
    };
  } | null;
}
