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

  const rowA: TileSpec[] = [
    { label: 'Contributions (all time)', value: formatInt(lifetime) },
    { label: `Contributions (${latestYear?.year ?? 'this year'})`, value: formatInt(thisYearTotal) },
    { label: 'Stars earned', value: formatInt(data.starsEarned) },
    { label: 'Followers', value: formatInt(data.followers) },
  ];
  const rowB: TileSpec[] = [
    { label: 'Pull requests merged', value: formatInt(data.mergedPullRequests) },
    { label: 'Issues opened', value: formatInt(data.issues) },
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
