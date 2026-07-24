/** Deterministic synthetic profile data for tests and the preview app. */

import type { DayContribution, ProfileData } from '../src/model.js';

/** mulberry32 — tiny seeded PRNG so fixtures never change between runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  const rand = mulberry32(20260722);
  const end = Date.parse('2026-07-22T00:00:00Z');
  const days: { date: string; count: number }[] = [];
  for (let index = 370; index >= 0; index -= 1) {
    const roll = rand();
    // Weekly rhythm with quiet weekends and occasional spikes.
    const count = roll < 0.28 ? 0 : roll > 0.97 ? Math.ceil(rand() * 30) : Math.ceil(rand() * 9);
    days.push({ date: dateStr(end - index * DAY_MS), count });
  }
  const max = Math.max(...days.map((day) => day.count));
  return days.map((day) => ({ ...day, count: day.count, level: levelFor(day.count, max) }));
}

/**
 * Deterministic daily series spanning 2014-01-01 through 2026-07-22, for the
 * lifetime heatmap and rhythm cards. Quiet weekends, occasional spikes, and a
 * gentle year-over-year drift so the wall of years is not uniform.
 */
function lifetimeDays(): DayContribution[] {
  const rand = mulberry32(20140101);
  const start = Date.parse('2014-01-01T00:00:00Z');
  const end = Date.parse('2026-07-22T00:00:00Z');
  const days: { date: string; count: number }[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const weekday = new Date(ms).getUTCDay(); // 0 = Sunday .. 6 = Saturday
    const weekend = weekday === 0 || weekday === 6;
    const roll = rand();
    const count = weekend
      ? roll < 0.7
        ? 0
        : Math.ceil(rand() * 4)
      : roll < 0.25
        ? 0
        : roll > 0.97
          ? Math.ceil(rand() * 30)
          : Math.ceil(rand() * 9);
    days.push({ date: dateStr(ms), count });
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  return days.map((day) => ({ ...day, level: levelFor(day.count, max) }));
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
    generatedAt: '2026-07-22T03:17:00.000Z',
  };
}
