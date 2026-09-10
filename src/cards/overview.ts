/** Overview card: eight stat tiles. */

import { CARD_PADDING } from '../config.js';
import type { ProfileData } from '../model.js';
import { el } from '../svg/dsl.js';
import { formatInt } from '../svg/text.js';
import type { Theme } from '../theme.js';
import { cardFrame, tileRow, type TileSpec } from './frame.js';

export function renderOverview(data: ProfileData, theme: Theme, fontFaceCss: string): string {
  const lifetime = data.years.reduce((sum, year) => sum + year.total, 0);
  const latestYear = data.years.at(-1);
  const thisYearTotal = latestYear?.total ?? 0;
  const firstYear = data.years[0]?.year;

  // Average per elapsed day of the latest year; lifetimeDays is clamped to
  // today, so counting its entries for the year is the elapsed-day count.
  const yearPrefix = `${latestYear?.year ?? ''}-`;
  const elapsedDays =
    latestYear === undefined ? 0 : data.lifetimeDays.filter((day) => day.date.startsWith(yearPrefix)).length;
  const dailyAverage = elapsedDays === 0 ? undefined : `Avg ${(thisYearTotal / elapsedDays).toFixed(1)} / day`;

  // A sparkline needs enough years to describe a shape; below four it is a
  // zigzag that reads as noise, so the whole band is withheld.
  const trends = data.years.length >= 4;
  const seriesOf = (pick: (year: (typeof data.years)[number]) => number): readonly number[] | undefined =>
    trends ? data.years.map(pick) : undefined;

  // Year to date against the same calendar window one year back. A full year
  // against a partial one would report every January as a collapse.
  const today = data.lifetimeDays.at(-1)?.date;
  const ytdThrough = today?.slice(5);
  const ytdFor = (year: number): number =>
    ytdThrough === undefined
      ? 0
      : data.lifetimeDays
          .filter((day) => day.date.startsWith(`${year}-`) && day.date.slice(5) <= ytdThrough)
          .reduce((sum, day) => sum + day.count, 0);
  const thisYear = today === undefined ? undefined : Number(today.slice(0, 4));

  // The year tile's own shape: months of the current year, so it says something
  // the all-time tile's yearly series does not.
  const monthsThisYear = (): readonly number[] | undefined => {
    if (!trends || thisYear === undefined) return undefined;
    const sums = new Map<string, number>();
    for (const day of data.lifetimeDays.filter((entry) => entry.date.startsWith(`${thisYear}-`))) {
      const month = day.date.slice(0, 7);
      sums.set(month, (sums.get(month) ?? 0) + day.count);
    }
    return [...sums.keys()].toSorted().map((month) => sums.get(month) ?? 0);
  };
  const priorYtd = thisYear === undefined ? 0 : ytdFor(thisYear - 1);
  const currentYtd = thisYear === undefined ? 0 : ytdFor(thisYear);
  const ytdDelta =
    !trends || priorYtd === 0
      ? undefined
      : {
          rising: currentYtd >= priorYtd,
          text: `${Math.abs(Math.round(((currentYtd - priorYtd) / priorYtd) * 100))}% YTD`,
        };

  // Peak year of a per-year series; undefined when every year is zero.
  const peakOf = (pick: (year: (typeof data.years)[number]) => number): string | undefined => {
    const best = data.years.reduce(
      (winner, year) => (pick(year) > winner.count ? { year: year.year, count: pick(year) } : winner),
      { year: 0, count: 0 }
    );
    return best.count === 0 ? undefined : `Peak ${best.year} · ${formatInt(best.count)}`;
  };

  const rowA: TileSpec[] = [
    {
      label: 'Contributions (all time)',
      value: formatInt(lifetime),
      sub: firstYear === undefined ? undefined : `Since ${firstYear}`,
      spark: seriesOf((year) => year.total),
    },
    {
      label: `Contributions (${latestYear?.year ?? 'this year'})`,
      value: formatInt(thisYearTotal),
      sub: dailyAverage,
      spark: monthsThisYear(),
      delta: ytdDelta,
    },
    // Scope note, not a second statistic: the number counts every owned public
    // repository including archived ones, which is the first thing a reader
    // wonders about a star total.
    { label: 'Stars earned', value: formatInt(data.starsEarned), sub: 'Forks excluded' },
    { label: 'Followers', value: formatInt(data.followers) },
  ];
  const rowB: TileSpec[] = [
    // Yearly peaks pair with the opened/typed per-year series — the closest
    // honest caption the API offers for these lifetime counters.
    {
      label: 'Pull requests merged',
      value: formatInt(data.mergedPullRequests),
      sub: peakOf((year) => year.pullRequests),
      spark: seriesOf((year) => year.pullRequests),
    },
    {
      label: 'Issues opened',
      value: formatInt(data.issues),
      sub: peakOf((year) => year.issues),
      spark: seriesOf((year) => year.issues),
    },
    {
      label: 'Public repositories',
      value: formatInt(data.publicSourceRepos),
      sub: `${formatInt(data.languages.length)} languages`,
    },
    // The API's repositoriesContributedTo is a rolling recent window, not a
    // career total — the label must say so, and the caption names the filter.
    { label: 'Contributed to (recent)', value: formatInt(data.contributedTo), sub: 'Excludes own repositories' },
  ];

  const top = 60;
  const gap = 12;
  const tilesA = tileRow(theme, rowA, top);
  const tilesB = tileRow(theme, rowB, top + tilesA.height + gap);
  const height = top + tilesA.height + gap + tilesB.height + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: 'Overview',
      note: `@${data.login} · public activity`,
      description: `GitHub overview for ${data.login}: ${formatInt(lifetime)} contributions all time, ${formatInt(data.starsEarned)} stars earned, ${formatInt(data.followers)} followers.`,
      fontFaceCss,
    },
    el('g', { class: 'fade' }, tilesA.svg, tilesB.svg)
  );
}
