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
}

export interface TrailingCalendar {
  /** Full weeks as returned by the API, oldest day first. */
  readonly days: readonly DayContribution[];
  readonly total: number;
  /** Whether the totals count private work the viewer cannot see the details of. */
  readonly includesPrivate: boolean;
}

/** One repository and the user's trailing-year commit contributions to it. */
export interface RepoCommits {
  readonly nameWithOwner: string;
  readonly commits: number;
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
