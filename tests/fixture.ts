/** Deterministic synthetic profile data for tests and the preview app. */

import { range } from '../src/iter.js';
import type { CommitSample, DayContribution, ProfileData, RepoCommits } from '../src/model.js';

const MULBERRY_INCREMENT = 0x6d2b79f5;

/**
 * The nth draw (1-based) of the mulberry32 stream for `seed` — deterministic
 * fixtures with no mutable cursor: the generator's only state transition is
 * adding a constant (mod 2^32), so the state after n draws is index-computable
 * and each builder threads a draw number instead of closing over state.
 */
function randAt(seed: number, drawNumber: number): number {
  const a = ((seed >>> 0) + drawNumber * MULBERRY_INCREMENT) >>> 0;
  const t1 = Math.imul(a ^ (a >>> 15), a | 1);
  const t2 = t1 ^ (t1 + Math.imul(t1 ^ (t1 >>> 7), t1 | 61));
  return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
}

function levelFor(count: number, max: number): DayContribution['level'] {
  if (count === 0) return 0;
  const q = count / max;
  if (q <= 0.25) return 1;
  if (q <= 0.5) return 2;
  if (q <= 0.75) return 3;
  return 4;
}

function dateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** 371 days (53 whole weeks) ending 2026-07-22, weekday-aligned like the API. */
function trailingDays(): DayContribution[] {
  const seed = 20260722;
  const end = Date.parse('2026-07-22T00:00:00Z');
  const { days } = range(371).reduce<{
    readonly draw: number;
    readonly days: readonly { readonly date: string; readonly count: number }[];
  }>(
    (acc, offset) => {
      const index = 370 - offset;
      const roll = randAt(seed, acc.draw);
      // Weekly rhythm with quiet weekends and occasional spikes. The second
      // draw happens only on active days, exactly like the generator it replays.
      const active = roll >= 0.28;
      const count = !active
        ? 0
        : roll > 0.97
          ? Math.ceil(randAt(seed, acc.draw + 1) * 30)
          : Math.ceil(randAt(seed, acc.draw + 1) * 9);
      return {
        draw: acc.draw + (active ? 2 : 1),
        days: [...acc.days, { date: dateStr(end - index * DAY_MS), count }],
      };
    },
    { draw: 1, days: [] }
  );
  const max = Math.max(...days.map((day) => day.count));
  return days.map((day) => ({ ...day, level: levelFor(day.count, max) }));
}

/**
 * Deterministic daily series spanning 2014-01-01 through 2026-07-22, for the
 * lifetime heatmap and rhythm cards. Quiet weekends, occasional spikes, and a
 * gentle year-over-year drift so the wall of years is not uniform.
 */
function lifetimeDays(): DayContribution[] {
  const seed = 20140101;
  const start = Date.parse('2014-01-01T00:00:00Z');
  const end = Date.parse('2026-07-22T00:00:00Z');
  const dayCount = (end - start) / DAY_MS + 1;
  const { days } = range(dayCount).reduce<{
    readonly draw: number;
    readonly days: readonly { readonly date: string; readonly count: number }[];
  }>(
    (acc, offset) => {
      const ms = start + offset * DAY_MS;
      const weekday = new Date(ms).getUTCDay(); // 0 = Sunday .. 6 = Saturday
      const weekend = weekday === 0 || weekday === 6;
      const roll = randAt(seed, acc.draw);
      const active = weekend ? roll >= 0.7 : roll >= 0.25;
      const count = !active
        ? 0
        : weekend
          ? Math.ceil(randAt(seed, acc.draw + 1) * 4)
          : roll > 0.97
            ? Math.ceil(randAt(seed, acc.draw + 1) * 30)
            : Math.ceil(randAt(seed, acc.draw + 1) * 9);
      return {
        draw: acc.draw + (active ? 2 : 1),
        days: [...acc.days, { date: dateStr(ms), count }],
      };
    },
    { draw: 1, days: [] }
  );
  const max = Math.max(1, ...days.map((day) => day.count));
  return days.map((day) => ({ ...day, level: levelFor(day.count, max) }));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Deterministic synthetic commits over the trailing year: weekday working
 * hours with a morning peak and an afternoon tail, quiet weekends, and a
 * small share of UTC-stamped (web UI) commits.
 */
function commitSamples(): readonly CommitSample[] {
  const seed = 20260817;
  const end = Date.parse('2026-07-22T00:00:00Z');
  const DRAWS_PER_COMMIT = 6; // hour condition, hour value, suffix, minute, additions, deletions
  const { samples } = range(365).reduce<{ readonly draw: number; readonly samples: readonly CommitSample[] }>(
    (acc, offset) => {
      const index = 364 - offset;
      const ms = end - index * DAY_MS;
      const weekday = new Date(ms).getUTCDay(); // 0 = Sunday .. 6 = Saturday
      const weekend = weekday === 0 || weekday === 6;
      const roll = randAt(seed, acc.draw);
      const active = weekend ? roll >= 0.6 : roll >= 0.2;
      const count = !active
        ? 0
        : weekend
          ? Math.ceil(randAt(seed, acc.draw + 1) * 3)
          : Math.ceil(randAt(seed, acc.draw + 1) * 6);
      const dayDraws = acc.draw + (active ? 2 : 1);
      const commits = range(count).map((n) => {
        const base = dayDraws + n * DRAWS_PER_COMMIT;
        const hour =
          randAt(seed, base) < 0.6
            ? 8 + Math.floor(randAt(seed, base + 1) * 4)
            : 13 + Math.floor(randAt(seed, base + 1) * 9);
        const suffix = randAt(seed, base + 2) < 0.05 ? 'Z' : '+09:00';
        return {
          date: `${dateStr(ms)}T${pad2(hour)}:${pad2(Math.floor(randAt(seed, base + 3) * 60))}:00${suffix}`,
          additions: Math.ceil(randAt(seed, base + 4) * 120),
          deletions: Math.floor(randAt(seed, base + 5) * 60),
        };
      });
      return { draw: dayDraws + count * DRAWS_PER_COMMIT, samples: [...acc.samples, ...commits] };
    },
    { draw: 1, samples: [] }
  );
  return samples;
}

const TYPESCRIPT = { name: 'TypeScript', color: '#3178c6' };
const RUST = { name: 'Rust', color: '#dea584' };
const KOTLIN = { name: 'Kotlin', color: '#A97BFF' };

/**
 * A ranking with a clear leader, mid-field ties, and a long name to exercise
 * truncation. The last two rows cover the card's two optional fields: a
 * repository with no detected language, and one with no stars.
 */
function topRepositories(): RepoCommits[] {
  return [
    { nameWithOwner: 'seijikohara/vizel', commits: 379, language: TYPESCRIPT, stars: 12 },
    { nameWithOwner: 'seijikohara/femto-car-launcher', commits: 371, language: RUST, stars: 4 },
    { nameWithOwner: 'seijikohara/kogu', commits: 308, language: KOTLIN, stars: 31 },
    { nameWithOwner: 'seijikohara/db-tester', commits: 194, language: KOTLIN, stars: 2 },
    { nameWithOwner: 'seijikohara/seijikohara', commits: 168, language: TYPESCRIPT, stars: 1 },
    { nameWithOwner: 'seijikohara/profile-cards-action', commits: 130, language: TYPESCRIPT, stars: 8 },
    {
      nameWithOwner: 'open-telemetry/opentelemetry-js-contrib-examples',
      commits: 24,
      language: TYPESCRIPT,
      stars: 1204,
    },
    { nameWithOwner: 'seijikohara/docker-compose-cache-action', commits: 24, language: TYPESCRIPT, stars: 3 },
    { nameWithOwner: 'seijikohara/dotfiles', commits: 9, language: null, stars: 0 },
  ];
}

export function makeFixture(): ProfileData {
  const trailing = trailingDays();
  return {
    login: 'seijikohara',
    name: 'Seiji Kohara',
    followers: 21,
    publicSourceRepos: 41,
    starsEarned: 84,
    mergedPullRequests: 1391,
    issues: 349,
    contributedTo: 14,
    languages: [
      { name: 'TypeScript', color: '#3178c6', bytes: 7_036_949 },
      { name: 'Kotlin', color: '#A97BFF', bytes: 2_760_299 },
      { name: 'Java', color: '#b07219', bytes: 2_051_464 },
      { name: 'Vue', color: '#41b883', bytes: 1_140_778 },
      { name: 'Rust', color: '#dea584', bytes: 708_082 },
      { name: 'Svelte', color: '#ff3e00', bytes: 153_850 },
      { name: 'SCSS', color: '#c6538c', bytes: 113_413 },
      { name: 'Groovy', color: '#4298b8', bytes: 91_455 },
      { name: 'Processing', color: '#0096D8', bytes: 79_705 },
      { name: 'Python', color: '#3572A5', bytes: 66_688 },
      { name: 'C++', color: '#f34b7d', bytes: 56_931 },
    ],
    years: [
      { year: 2014, total: 43, commits: 0, pullRequests: 0, issues: 0, reviews: 0, restricted: 42 },
      { year: 2015, total: 706, commits: 43, pullRequests: 0, issues: 0, reviews: 0, restricted: 658 },
      { year: 2016, total: 2051, commits: 56, pullRequests: 8, issues: 0, reviews: 0, restricted: 1985 },
      { year: 2017, total: 127, commits: 21, pullRequests: 3, issues: 0, reviews: 1, restricted: 97 },
      { year: 2018, total: 635, commits: 0, pullRequests: 0, issues: 0, reviews: 0, restricted: 635 },
      { year: 2019, total: 979, commits: 15, pullRequests: 0, issues: 2, reviews: 0, restricted: 961 },
      { year: 2020, total: 650, commits: 251, pullRequests: 5, issues: 3, reviews: 0, restricted: 384 },
      { year: 2021, total: 326, commits: 173, pullRequests: 0, issues: 3, reviews: 0, restricted: 144 },
      { year: 2022, total: 243, commits: 103, pullRequests: 1, issues: 0, reviews: 0, restricted: 138 },
      { year: 2023, total: 527, commits: 165, pullRequests: 0, issues: 0, reviews: 0, restricted: 360 },
      { year: 2024, total: 561, commits: 133, pullRequests: 1, issues: 0, reviews: 0, restricted: 427 },
      { year: 2025, total: 964, commits: 587, pullRequests: 259, issues: 72, reviews: 3, restricted: 34 },
      { year: 2026, total: 3333, commits: 1531, pullRequests: 1213, issues: 269, reviews: 3, restricted: 309 },
    ],
    lifetimeDays: lifetimeDays(),
    trailing: {
      days: trailing,
      total: trailing.reduce((sum, day) => sum + day.count, 0),
    },
    commits: commitSamples(),
    topRepositories: topRepositories(),
    trailingCommits: { total: 1432, repositories: 18 },
    generatedAt: '2026-07-22T03:17:00.000Z',
  };
}
