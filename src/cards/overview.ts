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
    },
    {
      label: `Contributions (${latestYear?.year ?? 'this year'})`,
      value: formatInt(thisYearTotal),
      sub: dailyAverage,
    },
    { label: 'Stars earned', value: formatInt(data.starsEarned) },
    { label: 'Followers', value: formatInt(data.followers) },
  ];
  const rowB: TileSpec[] = [
    // Yearly peaks pair with the opened/typed per-year series — the closest
    // honest caption the API offers for these lifetime counters.
    {
      label: 'Pull requests merged',
      value: formatInt(data.mergedPullRequests),
      sub: peakOf((year) => year.pullRequests),
    },
    { label: 'Issues opened', value: formatInt(data.issues), sub: peakOf((year) => year.issues) },
    { label: 'Public repositories', value: formatInt(data.publicSourceRepos) },
    // The API's repositoriesContributedTo is a rolling recent window, not a
    // career total — the label must say so.
    { label: 'Contributed to (recent)', value: formatInt(data.contributedTo) },
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
