/** Orchestrates the API calls and normalizes them into the domain model. */

import { DEFAULT_COMMIT_SWEEP_LIMIT } from '../config.js';
import type {
  CommitSample,
  PortfolioRepo,
  DayContribution,
  LanguageSlice,
  ProfileData,
  RepoCommits,
  TrailingCalendar,
  YearActivity,
} from '../model.js';
import { graphql } from './client.js';
import {
  COMMITS_QUERY,
  lifetimeCommitsQuery,
  PROFILE_QUERY,
  TRAILING_QUERY,
  YEAR_QUERY,
  type CalendarData,
  type CommitsQueryData,
  type ContributionLevelName,
  type LifetimeCommitsQueryData,
  type ProfileQueryData,
  type TrailingQueryData,
  type YearQueryData,
} from './queries.js';

const LEVELS: Record<ContributionLevelName, DayContribution['level']> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

function flattenCalendar(calendar: CalendarData): DayContribution[] {
  return calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: LEVELS[day.contributionLevel],
    }))
  );
}

type RepoNode = NonNullable<ProfileQueryData['user']>['repositories']['nodes'][number];

/**
 * Sum language bytes across source repositories, keeping the bytes the edge
 * cap left unnamed.
 *
 * `totalSize` counts every language in the repository; the edges only carry the
 * largest 30. Their difference is real code with no name attached, so it is
 * tracked separately rather than dropped — dropping it would make every
 * percentage a share of the wrong total.
 */
function aggregateLanguages(repos: readonly RepoNode[]): { slices: LanguageSlice[]; tailBytes: number } {
  const sources = repos.filter((repo) => !repo.isFork && !repo.isArchived);
  const totals = new Map<string, { color: string | null; bytes: number }>();
  for (const repo of sources) {
    for (const edge of repo.languages?.edges ?? []) {
      const entry = totals.get(edge.node.name);
      if (entry) {
        totals.set(edge.node.name, { color: entry.color ?? edge.node.color, bytes: entry.bytes + edge.size });
      } else {
        totals.set(edge.node.name, { color: edge.node.color, bytes: edge.size });
      }
    }
  }
  const tailBytes = sources.reduce((total, repo) => {
    const edges = repo.languages?.edges ?? [];
    const named = edges.reduce((sum, edge) => sum + edge.size, 0);
    return total + Math.max(0, (repo.languages?.totalSize ?? named) - named);
  }, 0);
  const slices = [...totals.entries()]
    .map(([name, { color, bytes }]) => ({ name, color, bytes }))
    .toSorted((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  return { slices, tailBytes };
}

/** Page through the profile query, one user snapshot per repository page. */
async function fetchProfilePages(
  token: string,
  login: string,
  cursor: string | null
): Promise<readonly NonNullable<ProfileQueryData['user']>[]> {
  const page: ProfileQueryData = await graphql<ProfileQueryData>(token, PROFILE_QUERY, { login, cursor });
  const user = page.user;
  if (!user) throw new Error(`user not found: ${login}`);
  const { pageInfo } = user.repositories;
  const rest = pageInfo.hasNextPage ? await fetchProfilePages(token, login, pageInfo.endCursor) : [];
  return [user, ...rest];
}

/**
 * Page through commits the user authored on one repository's default branch
 * within the sweep window. Returns [] for empty repositories (no default
 * branch) and skips commits without an author date, which cannot be bucketed.
 */
async function fetchRepoCommits(
  token: string,
  owner: string,
  name: string,
  authorId: string,
  since: string,
  cursor: string | null = null
): Promise<readonly CommitSample[]> {
  const page: CommitsQueryData = await graphql<CommitsQueryData>(token, COMMITS_QUERY, {
    owner,
    name,
    authorId,
    since,
    cursor,
  });
  const history = page.repository?.defaultBranchRef?.target?.history;
  if (!history) return [];
  const samples = history.nodes.flatMap((node) => {
    const date = node.author?.date;
    return date === null || date === undefined
      ? []
      : [
          {
            date,
            additions: node.additions,
            deletions: node.deletions,
            changedFiles: node.changedFilesIfAvailable,
          },
        ];
  });
  const { pageInfo } = history;
  const rest = pageInfo.hasNextPage
    ? await fetchRepoCommits(token, owner, name, authorId, since, pageInfo.endCursor)
    : [];
  return [...samples, ...rest];
}

/**
 * Lifetime default-branch commits by the author, one alias per repository.
 *
 * Returns an empty map for an empty list rather than sending a query with no
 * selections, which the API rejects.
 */
async function fetchLifetimeCommits(
  token: string,
  authorId: string,
  names: readonly string[]
): Promise<Map<string, number>> {
  if (names.length === 0) return new Map();
  const variables: Record<string, unknown> = { authorId };
  for (const [index, name] of names.entries()) {
    const [owner, repo] = name.split('/');
    variables[`o${index}`] = owner ?? '';
    variables[`n${index}`] = repo ?? '';
  }
  const data = await graphql<LifetimeCommitsQueryData>(token, lifetimeCommitsQuery(names.length), variables, {
    tolerate: ['NOT_FOUND'],
  });
  return new Map(
    names.flatMap((name, index) => {
      const total = data[`r${index}`]?.defaultBranchRef?.target?.history?.totalCount;
      return total === undefined ? [] : [[name, total] as const];
    })
  );
}

/**
 * Merge per-year daily series into one ascending run.
 * Year calendars are week-aligned, so edges spill a few days into neighboring
 * years; keep the higher count when the same date appears twice.
 */
export function mergeDailySeries(seriesPerYear: readonly (readonly DayContribution[])[]): DayContribution[] {
  const byDate = new Map<string, DayContribution>();
  for (const series of seriesPerYear) {
    for (const day of series) {
      const existing = byDate.get(day.date);
      if (!existing || day.count > existing.count) byDate.set(day.date, day);
    }
  }
  return [...byDate.values()].toSorted((a, b) => a.date.localeCompare(b.date));
}

/** How much of the per-repository commit sweep to run. */
export interface FetchOptions {
  /**
   * Sweep commits at all. The sweep exists only for the cadence card, and it is
   * the run's only cost that grows with repository count, so a run that does
   * not render that card should not pay for it.
   */
  readonly sweepCommits: boolean;
  /** Repositories the sweep visits, most recently pushed first; 0 = no cap. */
  readonly sweepLimit: number;
}

export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  sweepCommits: true,
  sweepLimit: DEFAULT_COMMIT_SWEEP_LIMIT,
};

export async function fetchProfile(
  token: string,
  login: string,
  options: FetchOptions = DEFAULT_FETCH_OPTIONS
): Promise<Omit<ProfileData, 'generatedAt'>> {
  // Page through owned public repositories (1 point per page). Every page
  // repeats the user scalars; the first snapshot serves them.
  const profilePages = await fetchProfilePages(token, login, null);
  const user = profilePages[0];
  if (user === undefined) throw new Error(`user not found: ${login}`);
  const repoNodes: readonly RepoNode[] = profilePages.flatMap((pageUser) => pageUser.repositories.nodes);

  const years = user.contributionsCollection.contributionYears.toSorted((a, b) => a - b);

  // One 1-point query per contribution year; the split is what keeps every
  // request far under the API's per-query resource budget.
  const yearResults = await Promise.all(
    years.map((year) =>
      graphql<YearQueryData>(token, YEAR_QUERY, {
        login,
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      })
    )
  );

  const yearActivities: YearActivity[] = [];
  const dailySeries: DayContribution[][] = [];
  for (const [index, result] of yearResults.entries()) {
    const year = years[index];
    const collection = result.user?.contributionsCollection;
    if (year === undefined || !collection) {
      throw new Error(`missing contributions for year index ${index}`);
    }
    yearActivities.push({
      year,
      total: collection.contributionCalendar.totalContributions,
      commits: collection.totalCommitContributions,
      pullRequests: collection.totalPullRequestContributions,
      issues: collection.totalIssueContributions,
      reviews: collection.totalPullRequestReviewContributions,
      restricted: collection.restrictedContributionsCount,
    });
    // Trim the week-aligned padding to the year itself before merging.
    dailySeries.push(flattenCalendar(collection.contributionCalendar).filter((day) => day.date.startsWith(`${year}-`)));
  }

  const trailingData = await graphql<TrailingQueryData>(token, TRAILING_QUERY, { login });
  const trailingCalendar = trailingData.user?.contributionsCollection.contributionCalendar;
  if (!trailingCalendar) throw new Error('missing trailing calendar');
  const trailing: TrailingCalendar = {
    days: flattenCalendar(trailingCalendar),
    total: trailingCalendar.totalContributions,
    includesPrivate: trailingData.user?.contributionsCollection.hasAnyRestrictedContributions ?? false,
  };

  // Public repositories only, whatever token runs the generator: a PAT sees
  // private repositories in this list, and their names must not leak onto a
  // publicly served card.
  // Issues are keyed by repository name so the ranking can carry them without
  // a second ordering; the privacy filter applies here for the same reason it
  // applies to commits.
  const issuesByRepo = new Map(
    (trailingData.user?.contributionsCollection.issueContributionsByRepository ?? [])
      .filter((entry) => !entry.repository.isPrivate)
      .map((entry) => [entry.repository.nameWithOwner, entry.contributions.totalCount])
  );

  const rankedRepos = (trailingData.user?.contributionsCollection.commitContributionsByRepository ?? []).filter(
    (entry) => !entry.repository.isPrivate
  );

  // One aliased selection per repository, in one request. Aliases resolve
  // independently, so a repository that vanished since the trailing query
  // fails only its own alias.
  const lifetimeCommits = await fetchLifetimeCommits(
    token,
    user.id,
    rankedRepos.map((entry) => entry.repository.nameWithOwner)
  );

  const topRepositories: RepoCommits[] = rankedRepos.map((entry) => ({
    nameWithOwner: entry.repository.nameWithOwner,
    commits: entry.contributions.totalCount,
    issues: issuesByRepo.get(entry.repository.nameWithOwner) ?? 0,
    lifetimeCommits: lifetimeCommits.get(entry.repository.nameWithOwner) ?? 0,
    language: entry.repository.primaryLanguage,
    stars: entry.repository.stargazerCount,
  }));

  const popular = trailingData.user?.contributionsCollection.popularPullRequestContribution?.pullRequest;
  const popularPullRequest =
    popular === undefined || popular.repository.isPrivate
      ? null
      : { title: popular.title, nameWithOwner: popular.repository.nameWithOwner };

  const trailingCollection = trailingData.user?.contributionsCollection;
  const trailingCommits = {
    total: trailingCollection?.totalCommitContributions ?? 0,
    repositories: trailingCollection?.totalRepositoriesWithContributedCommits ?? 0,
  };

  // The current year's calendar pads with zero-count FUTURE days up to the
  // requested `to`; keeping them would zero out the current streak. The
  // trailing (no-args) calendar ends today, so its last date is the clamp.
  const today = trailing.days.at(-1)?.date;
  if (today === undefined) throw new Error('trailing calendar is empty');
  const lifetimeDays = mergeDailySeries(dailySeries).filter((day) => day.date <= today);

  const sourceRepos = repoNodes.filter((repo) => !repo.isFork && !repo.isArchived);
  const languages = aggregateLanguages(repoNodes);

  const portfolio: PortfolioRepo[] = sourceRepos
    .map((repo) => ({
      nameWithOwner: repo.nameWithOwner,
      createdAt: repo.createdAt,
      pushedAt: repo.pushedAt,
      commits: repo.defaultBranchRef?.target?.history?.totalCount ?? 0,
      language: repo.primaryLanguage,
      stars: repo.stargazerCount,
      diskUsageKb: repo.diskUsage ?? 0,
      license: repo.licenseInfo?.spdxId ?? null,
    }))
    .toSorted((a, b) => b.commits - a.commits || a.nameWithOwner.localeCompare(b.nameWithOwner));

  // Sweep commits the user authored across owned source repositories over the
  // trailing 365 days — one paginated 1-point query per repository, fanned out
  // like the year queries. This powers the cadence card, and it is the only
  // part of a run whose cost grows with the number of repositories owned.
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  // `pushedAt` is an upper bound on every commit date in the repository, so a
  // repository last pushed before the window cannot hold a commit inside it:
  // dropping it removes a query without dropping a sample. Newest first, so a
  // cap keeps the repositories most likely to carry commits.
  const sweepCandidates = sourceRepos
    .filter((repo) => repo.pushedAt !== null && repo.pushedAt >= since)
    .toSorted((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
  const swept = !options.sweepCommits
    ? []
    : options.sweepLimit > 0
      ? sweepCandidates.slice(0, options.sweepLimit)
      : sweepCandidates;
  const commits = (
    await Promise.all(swept.map((repo) => fetchRepoCommits(token, login, repo.name, user.id, since)))
  ).flat();

  return {
    login,
    name: user.name,
    followers: user.followers.totalCount,
    publicSourceRepos: sourceRepos.length,
    starsEarned: repoNodes.filter((repo) => !repo.isFork).reduce((sum, repo) => sum + repo.stargazerCount, 0),
    mergedPullRequests: user.mergedPullRequests.totalCount,
    issues: user.issues.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
    languages: languages.slices,
    languageTailBytes: languages.tailBytes,
    years: yearActivities,
    includesPrivate: yearActivities.some((year) => year.restricted > 0),
    lifetimeDays,
    trailing,
    commits,
    commitSweep: { swept: swept.length, candidates: sweepCandidates.length },
    topRepositories,
    popularPullRequest,
    repositories: portfolio,
    trailingCommits,
  };
}
