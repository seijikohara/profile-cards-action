/** Domain model shared by fetch, compute, and render layers. */

/** One day on the contribution calendar. Level mirrors the API quartile enum. */
export interface DayContribution {
  /** ISO date, e.g. "2026-07-22". */
  readonly date: string;
  readonly count: number;
  /** 0 = NONE .. 4 = FOURTH_QUARTILE. */
  readonly level: 0 | 1 | 2 | 3 | 4;
}

/** Aggregated activity for one calendar year. */
export interface YearActivity {
  readonly year: number;
  /** contributionCalendar.totalContributions for the year window. */
  readonly total: number;
  readonly commits: number;
  readonly pullRequests: number;
  readonly issues: number;
  readonly reviews: number;
  /** Private contributions the viewer may not see details of. */
  readonly restricted: number;
}

export interface LanguageSlice {
  readonly name: string;
  /** Linguist color; null for languages without one. */
  readonly color: string | null;
  readonly bytes: number;
  /**
   * Owned source repositories the language appears in.
   *
   * Bytes on disk is a weak proxy for effort — one generated file outweighs a
   * year of careful work — and breadth is the cheapest corrective available.
   * It is scoped to repositories the user owns, like every other number on the
   * languages card, and must never be read as "languages I contribute to".
   */
  readonly repos: number;
}

export interface TrailingCalendar {
  /** Full weeks as returned by the API, oldest day first. */
  readonly days: readonly DayContribution[];
  readonly total: number;
  /** Whether the totals count private work the viewer cannot see the details of. */
  readonly includesPrivate: boolean;
}

/**
 * One owned public source repository, as the portfolio card reads it.
 *
 * `pushedAt` records a push by ANY author, automation included, so it is a
 * recency signal and never a health one: a finished, correct library needs no
 * pushes.
 */
export interface PortfolioRepo {
  readonly nameWithOwner: string;
  /** ISO datetime the repository was created. */
  readonly createdAt: string;
  /** ISO datetime of the last push by any author; null for an empty repository. */
  readonly pushedAt: string | null;
  /** Commits on the default branch by every author; 0 for an empty repository. */
  readonly commits: number;
  readonly language: { readonly name: string; readonly color: string | null } | null;
  readonly stars: number;
  /** Size on disk in KB, 0 when unmeasured. */
  readonly diskUsageKb: number;
  /** SPDX identifier, null when the repository carries no recognized license. */
  readonly license: string | null;
}

/** One repository and the user's trailing-year commit contributions to it. */
export interface RepoCommits {
  readonly nameWithOwner: string;
  readonly commits: number;
  /** Issues the user opened here in the same window; 0 when none. */
  readonly issues: number;
  /**
   * Commits the user authored here on the default branch over its whole life,
   * 0 when unknown.
   *
   * `commits` counts every branch, this counts the default branch only, so a
   * repository worked on through feature branches can report more trailing
   * commits than lifetime ones.
   */
  readonly lifetimeCommits: number;
  /** Linguist's pick for the repository; null when it has no detected language. */
  readonly language: { readonly name: string; readonly color: string | null } | null;
  readonly stars: number;
}

/**
 * How the trailing-year commit sweep was scoped.
 *
 * The sweep is the run's only per-repository query, so it is bounded twice: by
 * the push window, which drops nothing, and optionally by a cap, which does.
 * The cadence card discloses the difference.
 */
export interface CommitSweep {
  /** Repositories queried for commits. */
  readonly swept: number;
  /** Repositories that could hold a commit inside the window. */
  readonly candidates: number;
}

/** One commit authored by the user on a default branch, from the trailing-year sweep. */
export interface CommitSample {
  /** Author date as returned by the API — a GitTimestamp keeping the author's UTC offset. */
  readonly date: string;
  readonly additions: number;
  readonly deletions: number;
  /** Files touched, or null when GitHub has not computed the commit's diff. */
  readonly changedFiles: number | null;
}

export interface ProfileData {
  readonly login: string;
  readonly name: string | null;
  readonly followers: number;
  /** Public, non-fork, non-archived repositories owned by the user. */
  readonly publicSourceRepos: number;
  /** Stars across all owned repositories. */
  readonly starsEarned: number;
  readonly mergedPullRequests: number;
  readonly issues: number;
  /** Repositories the user contributed to but does not own. */
  readonly contributedTo: number;
  /** Aggregated bytes per language across owned source repos, descending. */
  readonly languages: readonly LanguageSlice[];
  /**
   * Bytes in languages past the per-repository edge cap, summed over source
   * repositories.
   *
   * These bytes have no language identity — the query never named them — so
   * they can only join "Other". Counting them keeps the percentages a share of
   * the real total rather than of what happened to fit.
   */
  readonly languageTailBytes: number;
  /** One entry per contribution year, ascending. */
  readonly years: readonly YearActivity[];
  /**
   * Whether any year's totals count private work.
   *
   * This says the numbers COUNT private contributions, not that the generator
   * can read them: it follows the profile's "include private contributions"
   * setting, and which contributions stay restricted depends on the token.
   */
  readonly includesPrivate: boolean;
  /** Deduplicated daily series across all years, ascending — streak input. */
  readonly lifetimeDays: readonly DayContribution[];
  /** Trailing ~12 months, for the 3D graph. */
  readonly trailing: TrailingCalendar;
  /** Commits authored by the user on owned default branches, trailing 12 months. */
  readonly commits: readonly CommitSample[];
  /** Scope of the sweep that produced `commits`. */
  readonly commitSweep: CommitSweep;
  /** Public repositories the user committed to, trailing 12 months, API order. */
  readonly topRepositories: readonly RepoCommits[];
  /** Owned public source repositories, most commits first. */
  readonly repositories: readonly PortfolioRepo[];
  /**
   * The trailing year's most-discussed pull request, wherever it landed.
   *
   * The only place on the deck where work outside the user's own repositories
   * surfaces by name. Null when the API nominates none.
   */
  readonly popularPullRequest: { readonly title: string; readonly nameWithOwner: string } | null;
  /** Trailing-year commit-contribution totals across ALL repositories the viewer can see. */
  readonly trailingCommits: { readonly total: number; readonly repositories: number };
  /** ISO timestamp of generation, minute precision. */
  readonly generatedAt: string;
}

export interface DateRange {
  /** ISO dates, inclusive. */
  readonly start: string;
  readonly end: string;
}

export interface Streaks {
  /** Consecutive active days ending at the calendar's last day (or the day before). */
  readonly current: number;
  readonly longest: number;
  /** Undefined when the corresponding streak is 0. */
  readonly currentRange: DateRange | undefined;
  readonly longestRange: DateRange | undefined;
}
