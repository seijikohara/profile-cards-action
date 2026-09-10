# Enhancement survey — what more the GitHub API can tell us

- **Date:** 2026-09-10
- **Status:** Delivered. Every recommendation below shipped across v1.3.0–v1.13.0;
  see [What shipped](#what-shipped). The rejections and dead ends stand as written
  and should not be re-investigated without new evidence.
- **Method:** A parallel survey swept the GitHub GraphQL and REST APIs for
  signal this action does not yet use, and inventoried the eight existing cards
  to find what they leave unanswered. Four independent lenses proposed
  candidates; each candidate was then handed to a skeptic instructed to refute
  it with live queries against the `seijikohara` account. Every number below was
  measured, not estimated.
- **Standing constraints:** GitHub data only (no external services); the
  canonical producer is a scheduled run using the default `GITHUB_TOKEN`;
  output is a static SVG loaded via `<img>` (no script, no interactivity);
  zero runtime dependencies beyond those already present.

## Two findings that reorder everything else

**Every one of the seven candidates sent to a skeptic was rejected** (churn,
shipping, releases, stars, outcomes, taste, repositories-matrix). What follows is
the survivors of a second pass: items whose data is already in `ProfileData`, or
whose fields were measured live in the API sweep, plus the salvage fragments the
skeptics themselves named. Unverified assumptions are marked as gates.

**The run is not cheap.** Measured live, `COMMITS_QUERY` costs **44 points across
44 GraphQL calls over 32 source repos** (two repositories need four pages each),
on top of `PROFILE_QUERY` (cost 1, nodeCount 1,100), twelve `YEAR_QUERY` calls,
and `TRAILING_QUERY` (cost 1) — roughly **58 points, growing linearly with owned
repository count**. The first item in the sequence is therefore a cost fix, not a
card.

---

## What shipped

| Item                                 | Shipped as                                                                                                                                                            | Release |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I1 · bound the commit sweep          | `pushedAt` gate (drops nothing), `commit-sweep-limit` input, and the cadence card discloses a capped sweep. Dropping `cadence` from `cards` skips the sweep entirely. | v1.3.0  |
| E2 · private-contribution disclosure | `lifetime`, `contributions`, `composition` print `INCL. PRIVATE` or `PUBLIC ONLY` beside the title.                                                                   | v1.4.0  |
| E3 · exact language total            | `languages(first: 30)` with `totalSize`; the unnamed remainder joins `Other` and the denominator.                                                                     | v1.5.0  |
| E7 · numeric ramp legend             | `legend: scale` prints the band each ramp step covers, per card, in that card's unit.                                                                                 | v1.6.0  |
| N1 · `momentum`                      | Rolling twelve-month total, sampled weekly — the deck's only chart that can fall.                                                                                     | v1.7.0  |
| E4 · overview trends                 | Sparklines on the four tiles with a real series, plus a YTD change chip.                                                                                              | v1.8.0  |
| N2 · `portfolio`                     | One lifeline per owned repository, creation to last push, with language, commits, license.                                                                            | v1.9.0  |
| E8 · rhythm then vs now              | Every bar carries a reference tick at the trailing year's position in its own panel.                                                                                  | v1.10.0 |
| E5 · commit-size strip               | Five log buckets of lines per commit, `changedFilesIfAvailable` for lines per file; the raw churn total became a median.                                              | v1.11.0 |
| E6 + E9 · repositories depth         | Issues column, most-discussed-PR caption, and each bar set on a lifetime track.                                                                                       | v1.12.0 |
| E3b · language reach                 | The ranked list reports how many repositories each language turns up in.                                                                                              | v1.13.0 |

Two things were learned while building that the survey did not predict:

- **The frame's reduced-motion reset applies `opacity: 1 !important` to every
  element.** Any static opacity is therefore ignored for those viewers, and a
  `clip-path` reveal is _not_ undone by it. Both bit during `momentum`; the fix
  is `fill-opacity` for tints and an explicit `clip-path: none` under
  `prefers-reduced-motion`.
- **Card lists repeated outside the renderer go stale silently.** The example
  gallery had its own list in two places and never rendered the new cards, which
  left the README pointing at files that did not exist. `KNOWN_CARDS` is now the
  only list.

---

## Signal GitHub exposes that the deck does not use

| Signal                                                           | Where it comes from                                                                                                                             | Missing from the deck?                                                                            | Worth adding?                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Following, starred, watching and organization counts             | `user.following.totalCount`, `user.starredRepositories.totalCount`, `user.watching.totalCount`, `user.organizations.totalCount`                 | Yes                                                                                               | **Vanity, and two are traps.** `watching` is viewer-scoped (measured: total 74 = PUBLIC 27 + PRIVATE 47; GITHUB_TOKEN would print 27). `organizations` returned 0 even with `read:org` because it lists _public_ memberships only — printing "0 organizations" for a user whose org work is SAML-private actively misrepresents them. Skip. |
| Per-repository forks, watchers, disk usage and license           | `user.repositories.nodes.{forkCount,diskUsage,licenseInfo{spdxId}}`, `.watchers.totalCount`                                                     | Yes                                                                                               | Yes, as **footer facts on a portfolio card**, not as tiles. Verified free inside the repositories page (45 repos: 22 forks, 26 watchers, 352 MB, MIT 19 / Apache-2.0 2 / unlicensed 24).                                                                                                                                                    |
| Whether the counted contributions include private work           | `contributionsCollection.{hasAnyRestrictedContributions,earliestRestrictedContributionDate,latestRestrictedContributionDate,startedAt,endedAt}` | Yes                                                                                               | **Yes — the highest honesty-per-byte item found.** Free selections on a connection we already fetch. See E2.                                                                                                                                                                                                                                |
| Additions and deletions over time                                | REST `/stats/contributors`, which **returns a persistent HTTP 202** (retried 3× over 12s on three repos, always `{}`)                           | We hold _better_ data already (`CommitSample.additions/deletions`)                                | Partly. The weekly diverging chart was vetted and rejected (see below); only the **commit-size distribution** survives, as a strip on `cadence`.                                                                                                                                                                                            |
| Star growth over time                                            | `Repository.stargazers(orderBy:STARRED_AT).edges.starredAt`                                                                                     | Yes                                                                                               | **No — unreachable.** Gated on `viewerCanAdminister`; silently returns `totalCount 0` for every repo the viewer does not administer. See Rejected.                                                                                                                                                                                          |
| Open / closed / merged ratios for pull requests and issues       | `user.pullRequests(states:…).totalCount`, `user.issues(states:…).totalCount`                                                                    | Yes                                                                                               | **No.** Free, but degenerate on real data: 96.3 / 3.7 / 0.06 renders a 0.51px segment. Vanity dressed as a ratio.                                                                                                                                                                                                                           |
| Hour-of-day and weekday commit profiles                          | REST events (~300-event window)                                                                                                                 | No — `cadence` + `rhythm` are strictly better (full trailing year of author-local `GitTimestamp`) | Already ours. The only uncovered novelty (indentation style, chars/line) needs patch parsing.                                                                                                                                                                                                                                               |
| Contribution calendar variants                                   | `contributionCalendar`                                                                                                                          | No — `lifetime` and `contributions` cards                                                         | Already ours.                                                                                                                                                                                                                                                                                                                               |
| Language mix                                                     | `Repository.languages`                                                                                                                          | No — `languages` card                                                                             | Ours, but **truncating**: we ask `languages(first:10)` per repo and never account for the tail. See E3.                                                                                                                                                                                                                                     |
| Discussion and gist counts                                       | `user.repositoryDiscussions`, `user.gists`                                                                                                      | Yes                                                                                               | Thin: 0 / 6 for this account. Cheap but empty; only defensible as an opt-in card for maintainers. Skip.                                                                                                                                                                                                                                     |
| The public event feed                                            | REST `/users/{login}/events/public`                                                                                                             | Yes                                                                                               | **No.** Measured depth: 114 events, ~3 weeks, page 4 returns HTTP 422; `PushEvent.payload.size` is null in the public feed. A card built on it changes shape weekly for reasons unrelated to the user.                                                                                                                                      |
| Reaction counts, contributor avatars                             | nested reaction connections / avatar mosaics                                                                                                    | Yes                                                                                               | No. Nested pagination over hundreds of nodes; avatars must be base64-inlined and carry no magnitude.                                                                                                                                                                                                                                        |
| Profile achievements, star lists, repository topics              | github.com HTML only — no API                                                                                                                   | Yes                                                                                               | **No — no API exists** (schema introspected: zero hits for achieve/badge/trophy; `/users/{login}/achievements` → 404). Incompatible with zero-dependency TS.                                                                                                                                                                                |
| Projects, sponsorship detail, repository traffic                 | Projects V2 / Sponsors / traffic REST                                                                                                           | Yes                                                                                               | **No — scope red flags** (see Rejected § dead ends).                                                                                                                                                                                                                                                                                        |
| CI outcomes (Actions runs)                                       | REST `/repos/{o}/{r}/actions/runs?status=…&per_page=1` → `total_count`                                                                          | Yes                                                                                               | Maybe, opt-in. Verified anonymously readable. Parked; see Rejected § parked.                                                                                                                                                                                                                                                                |
| Per-repository hour-of-week, weekly churn, 52-week participation | REST `/stats/punch_card`, `/stats/code_frequency`, `/stats/participation` (all 200, anonymous)                                                  | Yes                                                                                               | Low: repo-wide (all authors) and UTC, so they duplicate `cadence` less accurately. Note that their sibling `/stats/contributors` is the one that 202s forever.                                                                                                                                                                              |

## Recommended new cards

### N1 · `momentum` — rolling 12-month contribution total

**Question it answers:** am I speeding up or slowing down — over eleven years, not twelve months?

**Why this and not a cumulative curve:** a cumulative total is monotone and therefore always flattering (a dead year still slopes up). A trailing-365-day rolling sum, sampled weekly, is the same data drawn so that it _can fall_. It is the deck's first line chart and the only card that can say "output is declining".

**Chart form:** one continuous polyline over the account lifetime. X = weeks from `first contribution + 365d` to today (the first year is excluded, not ramped, because a partial window fabricates a rise). Y = sum of `count` over the preceding 365 days at that week. 2px stroke in `contribRamp[4]` over an area fill in `contribRamp[2]` at ~18% opacity, no gridlines, year ticks in `.t-tick` on a single 0.5-offset baseline rule. The all-time peak of the rolling series gets a foreground-ink ring (existing emphasis idiom — never a second hue) and a `.t-mono` label. Right end cap carries the current rolling total in `.t-value`. Entry motion: left-to-right `clip-path` sweep, reusing the `lifetime` card's column-sweep idiom. ~560 vertices at weekly resolution over 798px (1.4px/week) — no simplification needed, but do not sample daily (4,300 vertices).

```
┌ 846 ────────────────────────────────────────────────────────────────────┐
│ Momentum                          ALL CONTRIBUTION TYPES · ALL YEARS    │ 43
│                                                                         │
│                                                        ◯ peak 2,914 ╭─  │
│                                                   ╭────╮   ╭────────╯   │ 180px
│                                          ╭───╮ ╭──╯    ╰───╯       2,610│ plot
│  ╭───╮      ╭──╮     ╭──────╮  ╭────╮ ╭──╯   ╰─╯                        │
│ ─╯   ╰──────╯  ╰─────╯      ╰──╯    ╰─╯                                 │
│ ├─────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤  │
│ 2016  2017   2018   2019   2020   2021   2022   2023   2024   2025  2026│ ticks
│                                                                         │
│ 6,170 contributions since 4 Nov 2014 · trailing year 2,610 ·            │ footer
│ peak Aug 2026 · quietest year 2019                       REFRESHED …    │
└─────────────────────────────────────────────────────────────────────────┘
```

**API fields:** none new. `ProfileData.lifetimeDays[] {date, count}`, already built from `user.contributionsCollection.contributionCalendar.weeks.contributionDays{date,contributionCount}` in `YEAR_QUERY`. Optional free annotation of the origin: `user.contributionsCollection(from,to).joinedGitHubContribution{occurredAt}` and `.firstRepositoryContribution{occurredAt ... on CreatedRepositoryContribution{repository{name}}}` — verified live at **cost 1 / nodeCount 0**, but they resolve **only** when the `from`/`to` window contains the event (a 2016 window returned `null`), so select them on the earliest year's existing `YEAR_QUERY` only.

**API cost:** **zero.** No new document, no new selections in the required form.

**GITHUB_TOKEN safety:** safe — same connection the action already reads under the scheduled run. The one caveat is not a token issue: `restrictedContributionsCount` inclusion depends on the user's _"include private contributions"_ profile setting, which is exactly why E2 ships alongside.

**Colour contract:** one green ramp, magnitude only. Stroke = `contribRamp[4]`, fill = `contribRamp[2]`, emphasis = foreground-ink ring. No categorical hue anywhere.

**Ship-blocking check:** with fewer than ~24 months of history the series is shorter than the window it summarises — degrade to the `languages` 96px stub pattern (`"Needs two years of history"`), do not draw a two-point line.

---

### N2 · `portfolio` — repository lifelines

**Question it answers:** behind the repo count, which projects are still alive and which stopped?

This is the card that unflattens the per-repository dimension the inventory names as gap #3 (language mix, stars, and activity per repo are all fetched in full and summed into globals).

**Chart form:** Gantt/lifeline strip on a shared lifetime axis (oldest repo `createdAt` → today, year ticks in `.t-tick`). One 24px row per repository, top 12 by `defaultBranchRef.target.history.totalCount`, each row a 4px rounded rule from `createdAt` to `pushedAt`, terminated by a dot whose ramp level encodes push recency (<30d → 4, <90d → 3, <1y → 2, older → 1). Left gutter: linguist-coloured language dot + the two-tone `owner/name` ink the `repositories` card already uses. Right gutter: commit count in `.t-stat` and a `.t-mono` SPDX chip (or a muted dash). Derived height: `60 + 12×24 + footer 28 + CARD_PADDING`.

```
┌ 846 ────────────────────────────────────────────────────────────────────┐
│ Portfolio                    PUBLIC SOURCE REPOSITORIES · PUSH RECENCY  │
│                                                                         │
│ ● vizel                    ├──────────────────────────────●   540  MIT  │
│ ● femto-car-launcher                    ├─────────────────●   452  —    │
│ ● logback-access-…-starter ├───────────────────────────●      205  Apa. │
│ ● springboot4-nuxt4              ├────────────●               437  MIT  │
│ ● google-map-ts-vue3    ├───────────────●                     209  MIT  │
│ ● json-tree-view-vue3   ├──────────────────────●              230  MIT  │
│ ● switch-ts             ├─────────●                            88  —    │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤       │
│  2016   2017   2018   2019   2020   2021   2022   2023   2024  2026     │
│                                                                         │
│ 45 public source repos · 14 pushed in the last 90 days · 21 licensed ·  │
│ 352 MB on disk · 22 forks · top 12 shown          ▪▪▪▪▪ pushed recently │
└─────────────────────────────────────────────────────────────────────────┘
```

**API fields** (all measured free inside the `repositories` page `PROFILE_QUERY` already paginates):

```graphql
user.repositories(first:100, isFork:false, privacy:PUBLIC, ownerAffiliations:OWNER) {
  nodes {
    nameWithOwner
    createdAt                     # verified: oldest sampled 2020-10-23, newest 2026-07-24
    pushedAt
    diskUsage                     # verified: 360,431 KB over 45 repos
    forkCount                     # verified: 22
    isArchived
    licenseInfo { spdxId }        # verified: MIT 19 / Apache-2.0 2 / null 24
    watchers { totalCount }       # verified: 26
    primaryLanguage { name color }
    defaultBranchRef { target { ... on Commit { history { totalCount } } } }
  }                               # verified: 5,341 default-branch commits across 45 repos
}
```

**API cost:** **+0–2 points, no new request.** Measured anchors: baseline `PROFILE_QUERY` = `{cost:1, nodeCount:1100}`; the kitchen-sink repositories document (this block _plus_ releases, stargazers, refs, per-repo issues/PRs) measured `{cost:4, nodeCount:22212, errors:0}`. This block alone is scalars plus two `totalCount`s, so it sits at the bottom of that range. No pagination.

**GITHUB_TOKEN safety:** safe. Every field is public repo metadata; `licenseInfo`, `diskUsage`, `forkCount`, `watchers` and `defaultBranchRef…history.totalCount` were all confirmed readable at `viewerPermission: READ` on repos the token has no relationship with (control: `kovidgoyal/kitty`).

**Colour contract:** the ramp encodes _recency as magnitude_ (more recent = darker), which is the same reading the `lifetime` and `contributions` cards teach. Language identity uses linguist colours, already sanctioned. No categorical hue.

**Ship-blocking checks (do these before writing the renderer):**

1. **`pushedAt` is bumped by any push by any author, including automation.** This account's release automation is prolific (70 of 98 releases authored by `development-automation-bot[bot]`), so "pushed 3 days ago" can mean "a bot bumped a lockfile". The note line must read _push recency (any author)_ and the ramp must never be labelled "health" or "stale" — a finished, correct library needs no pushes.
2. Count how many of the 45 repos have a non-null `defaultBranchRef` (empty repos return null → render the row with no commit count, not a zero).
3. Under ~4 repos, degrade to a stub.

---

## Recommended enhancements to existing cards

### I1 · `commit-sweep-budget` — gate the sweep on `pushedAt`, expose a cap _(do this first)_

The sweep is the only cost in the run that is unbounded in the user's repo count, and it is 76% of the current bill (44 of ~58 points). Add `pushedAt` to the `PROFILE_QUERY` repositories nodes (free, verified) and in `fetch-profile.ts` skip `COMMITS_QUERY` for any repo whose `pushedAt` predates the sweep's `since` boundary. **`pushedAt` is a hard upper bound on any commit date on any branch, so this cut cannot drop a commit inside the window** — it is correctness-preserving, not a sample. For this account it takes the sweep from 32 repos toward the ~14 pushed in the trailing year.

Add two `action.yml` inputs: `commit-sweep-limit` (integer, **default 0 = unlimited**, so no existing user's card changes) capping the sweep to the N most-recently-pushed source repos, and `commit-sweep` (`on|off`) to drop `cadence` and its cost entirely. Whenever the cap actually bites, the `cadence` note must gain `· 15 OF 45 REPOSITORIES` and the footer wording must shift from "total commits" to "commits swept" — the card currently reads as if it swept everything.

### E2 · `provenance` — say whether private work is counted

Add to the collection already fetched by `YEAR_QUERY` / `TRAILING_QUERY`:
`contributionsCollection { hasAnyRestrictedContributions earliestRestrictedContributionDate latestRestrictedContributionDate startedAt endedAt }` — verified live (`true`, `2025-09-25`, `2026-09-08`, window `2025-09-06 → 2026-09-10`), **free**, same connection.

Render one `.t-mono` uppercase caption in the existing note/footer slot on the calendar-derived cards (`contributions`, `composition`, `lifetime`): `INCLUDES PRIVATE CONTRIBUTIONS · SEP 2025 – SEP 2026`, else `PUBLIC CONTRIBUTIONS ONLY`. Wording must not imply the generator can _see_ private repositories — the flag says restricted contributions were **counted**, and it depends on the user's profile setting, not on the token. One line only; the frame has exactly one note slot.

This is the precondition for trusting any number on the deck that is viewer-scoped, and the measured discrepancy is not small: the workflow's own committed `overview.light.svg` reads **1,492 merged PRs / 314 issues**, while a local PAT run of the same fields returns **2,362 / 616** — ~2.0× inflation from SAML-protected org work.

### E3 · `languages` — stop truncating the tail; add repo reach

Change one existing selection from `languages(first:10, orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}` to `languages(first:30, …){ totalSize totalCount edges{ size node{ name color } } }`. Verified free — it replaces a selection inside a page already being paid for (`totalSize` / `totalCount` returned per repo: femto-car-launcher 2,616,644 / 9 languages).

Two effects. (a) **Correctness:** `totalSize` minus the summed edges is the honest untruncated remainder, so the "Other" row becomes exact and the percentages stop summing to 100% of a slightly wrong denominator. This account is one language away from silently truncating today. (b) **Reach:** keep the per-repo edge lists in `aggregateLanguages()` instead of flattening straight to a global byte map, and each key-list row gains a `.t-tick` `in 6 repos` column plus a 4px unit strip of ticks in `barFill()` (cap 12 + overflow tick). Bytes-on-disk is a weak proxy for effort; breadth is the cheapest corrective and it is already in the response. Reach inherits the card's ownership scope — it must never be read as "languages I contribute to", since **per-author language attribution does not exist anywhere in the API**.

### E4 · `overview` — sparklines and a YTD delta

Zero API. Four of the eight tiles have a real series in `ProfileData.years[]` (`.total`, `.commits`, `.pullRequests`, `.issues`); stars and followers have none and never can. Draw a ~158×22 baseline-anchored sparkline in the tile's sub-caption slot: area in `contribRamp[2]`, 1.5px top line in `contribRamp[3]`, `contribRamp[4]` end dot on the current year. The delta chip must be **YTD vs the same window one year back**, computed from `lifetimeDays[]`, not full-year vs partial-year — otherwise every January reads as a collapse. Label it `YTD` explicitly, draw the triangle as a path (the font is subsetted), and suppress the whole band under 4 contribution years, keeping today's text caption. Decide the ragged-grid problem deliberately: series tiles first, snapshot tiles second, with the empty band reserved so the grid keeps one rhythm.

### E5 · `cadence` — commit-size distribution strip _(the only survivor of `churn`)_

The trailing-year per-commit churn is the largest fetched-but-unused item in the codebase, paid for by the most expensive query in the run and collapsed into two footer scalars. The skeptic killed the weekly diverging chart (additions vs deletions correlate at **r = 0.911**; 79% of weeks would render as near-symmetric butterflies; 83% of weeks are net growth so the sign is near-constant; and the weekly shape restates the trailing rhythm at Spearman 0.863) but explicitly salvaged the distribution.

Draw a five-bucket log histogram of commit size below the punch card, using `barFill()`: measured live over 1,841 commits — `0 lines: 9 · 1–9: 199 · 10–99: 488 · 100–999: 682 · 1000+: 463`, median 205, p90 3,246. Lead with **lines per file**, not lines per commit: add `changedFilesIfAvailable` to the existing `COMMITS_QUERY` node selection (free, verified live in the replicated sweep) and print `median 35 lines per file`. That single ratio is what separates hand-edits from bundle dumps, and it matters here: file-level classification of the 60 largest commits (55% of the year's churn) found **65.1% of those lines are generated or vendored** (`dist/index.js`, `pnpm-lock.yaml`, `licenses.txt`, committed SVG) — one commit was 94% a single generated bundle. Never print a raw "+1,877,624 lines" headline, and never attribute churn to a language.

### E6 · `repositories` — one ISSUES column + the popular-PR caption

The four-column matrix was rejected (COMMITS ≈ PRS at r = 0.93 / 0.98 with identical ramp levels on 6 of 10 rows; the REVIEWS column is a single cell of value 1 that per-column normalisation paints at maximum green; ~200px of the 408px bar surrendered). Two fragments survive, both free — the extended `TRAILING_QUERY` measured `{cost:1, nodeCount:4}` against a `{cost:1, nodeCount:1}` baseline, unchanged even at `maxRepositories:100`:

- `issueContributionsByRepository(maxRepositories:25){ repository{ nameWithOwner isPrivate } contributions(first:1){ totalCount } }` → a single 10px ramp column beside the bar (6 of 10 rows non-zero: vizel 122, db-tester 102, logback 51, kogu 21, docker-compose-cache-action 7, femto 2). `isPrivate` must feed the existing privacy filter.
- `popularPullRequestContribution{ pullRequest{ title repository{ nameWithOwner } } }` → a right-aligned `.t-mono` caption. Verified stable across window shifts of 0/7/30/60/90 days (`kovidgoyal/kitty`, 5 comments) and it is the only place in the deck where **external** work surfaces. It returned `null` for the 2021–2023 windows despite 100–170 commits in those years, so it must degrade to nothing.

Do **not** add PRS (redundant) or REVIEWS (`totalPullRequestReviewContributions` by year: 2021:0, 2022:0, 2023:0, 2024:0, 2025:3).

### E7 · `quantitative-ramp-legend` — put numbers on the ramp

Three cards ship a magnitude ramp the reader cannot decode, and the project already computes the bounds and throws them away. `rampLegend()` in `src/cards/legend.ts` gains a labelled mode: the five swatches keep their geometry and each gets a `.t-tick` caption 11px below (`0 · 1–7 · 8–19 · 20–41 · 42+`); "Less/More" is dropped because the numbers carry the direction. `rampLegendWidth()` recomputes from `measureMono` so every caller's right-alignment keeps working untouched. Sources, all zero-cost and all already computed: `LifetimeData.thresholds` (documented in `src/compute/lifetime.ts` as "for reference/testing", rendered nowhere), `computeThresholds()` in `src/compute/cadence.ts` (currently module-local), and for `contributions` the bounds are derivable by grouping `trailing.days` on `DayContribution.level` and taking the min count per level — which finally uses the API's own `contributionLevel` for something beyond a fill lookup. Gate behind a `legend: ramp|scale` input. Fallback when the measured captions overflow: label only the first, middle and last swatch. The unit is named once in each card's footer sentence, since each card's thresholds are self-relative.

### E8 · `rhythm` — then vs now

Zero API. Draw each weekday and month bar twice on the same baseline as **share of its own window**: a 1px outlined bar in `theme.border` for the lifetime profile and a filled `barFill()` bar for the trailing 12 months, 6px offset with a connecting hairline. Only the trailing bar keeps its value label; the pair is keyed once on the footer baseline. Footer facts become paired (`weekend share 21% lifetime → 14% trailing`). The trailing series is a date filter on the `lifetimeDays[]` array already in the model, clamped to the same "today" that `fetch-profile.ts` derives from `trailing.days.at(-1).date`. This finally consumes `RhythmData.peakWeekday` / `peakMonth`, computed today and referenced by no renderer. Switching to share hides magnitude, so keep the population and busiest-day counts in the footer; degrade to today's single-series card when the lifetime span is under ~1.5× the trailing window.

### E9 · `repositories` — lifetime bullet track _(gated on one probe)_

Turn each row into a bullet chart: the existing 408px bar area becomes a 12px `theme.bgInset` track scaled to the largest **lifetime** commit count across the ten rows, with the green trailing-year bar drawn on top at the same scale, so bar-vs-track length reads directly as "share of this repo's history that is recent". The right-aligned value becomes `412 / 1,208`. This repairs the card's two stated weaknesses at once (no history; lifetime stars sitting beside a trailing-year bar in two different time bases).

Data: one extra document with ten aliases, `repository(owner:$o,name:$n){ defaultBranchRef{ target{ ... on Commit{ history(author:{id:$authorId}){ totalCount } } } } }`.

> **Verification gate:** `defaultBranchRef.target.history.totalCount` is verified free and unfiltered inside the repositories page (5,341 across 45 repos), and `history(author:{id:…}, since:…)` is proven in production by `COMMITS_QUERY`. The exact combination used here — **`history(author:…)` with no `since`, addressed by alias on repos the token does not own** — was _not_ measured. Run one probe before implementing; if the point cost is not 1 for ten aliases, drop this item.

Degradations: `defaultBranchRef` is null on an empty repo → render the bar with no track. Commits on non-default branches are counted by `commitContributionsByRepository` but not by `history`, so a bar can exceed its track — clamp and disclose. Names must stay `isPrivate`-filtered before any name enters the alias query.

---

## Rejected, and why

### Vetted against the live API and failed

| Idea                                                                 | Verdict       | The decisive evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`churn`** — weekly diverging additions/deletions                   | reject        | The diverging axis is empirically hollow: additions vs deletions **Pearson r = 0.911**, 34 of 43 drawable weeks would show + and − bars differing by <10px at the proposed geometry, and 83% of active weeks are net growth so the sign barely varies. The 53-column shape restates the trailing rhythm (Spearman 0.863 vs weekly contributions; 0.745 in the sqrt space actually drawn). The footer scalars are literally the two numbers `cadence` prints today, and 65.1% of the sampled churn behind them is generated/vendored. Salvage → **E5**.                                                                                                                                                                                                                                                                                             |
| **`shipping`** / **`releases`** — release timeline                   | reject (both) | `releases.nodes.author{login}` — a field neither candidate selected — gives **70 `development-automation-bot[bot]` + 12 `github-actions[bot]` + 16 `seijikohara`: 86% machine-published**, so the card's thesis ("a release means I decided this was done") is false for almost every mark. The headline cadence is CI's: median gap between consecutive releases **1.48 days**, 33% same-day, six versions of one package published on 2026-05-28. Geometry fails too: at 846px the axis is ~0.89px/day, so 130 top-8 releases resolve to **62 distinguishable 5px ticks**, and the 24-month × 8-row grid is **84% empty**. The "63 tags carry no release" footer is inverted — 60 of those 63 are genuine npm/Maven versions from 2015–2020, i.e. a decade of shipping reported as an absence. The axis itself covers 1.4 of 11.8 account years. |
| **`stars`** / **`traction`** / **`reception`** — star-growth curve   | reject (all)  | **Hard blocker.** `Repository.stargazers` resolves only when `viewerCanAdminister` is true. Probed across 15+ repos: `vaadin/tori` (40 stars), `kovidgoyal/kitty` (34,843), `facebook/react` (249,642) and **all 100** of sindresorhus's repos returned `stargazers.totalCount 0` while `stargazerCount` was correct — **cost 1, zero errors, no `INSUFFICIENT_SCOPES`**. REST agrees (`/stargazers` → 404 for non-owned; 401 anonymous). The scheduled GITHUB_TOKEN is scoped to `seijikohara/seijikohara` alone (0 stars), so the card would draw a flat zero line beside an overview tile reading 96. This is the `branchProtectionRules` trap exactly. Making it work needs a **classic PAT with `repo` scope** — forbidden. The survey's "anonymously readable" note is stale; GitHub has since restricted it.                                |
| **`outcomes`** / **`followthrough`** — open/closed/merged ratio bars | reject (both) | Fields and zero cost verify (`{cost:1, nodeCount:1100}` before and after grafting all four aliases). The chart does not: under GITHUB_TOKEN the real split is **96.27 / 3.66 / 0.06** → on 798px the "open" segment is **0.51px, thinner than its own 1px stroke** and invisible inside `rx:4`. Both secondary labels fall to the caption line, so the card is two solid green rectangles plus text. **1,483 of 1,499 merged PRs (98.9%) are in the user's own repos and 29/29 of the newest visible merges were self-merged** — the 96% "merge rate" is a self-merge counter. The ratio is viewer-scoped too (96.27% token vs 93.58% PAT). Salvage: `57 CLOSED UNMERGED` / `5 STILL OPEN` as free overview sub-captions.                                                                                                                          |
| **`taste`** — written vs starred languages                           | reject        | Premise falsified. Written bytes measured live are **TypeScript 35.7 / Rust 18.3 / Kotlin 17.6 / Java 12.0**, not "Kotlin/Java/TypeScript"; starred (newest 100) is **TypeScript 42 / Rust 16**. Top two agree, in order — the chart answers its own question "yes" as two mirrored bars. The message is a window artifact: TypeScript, Rust and Java all **reverse direction** between the newest-100 and the all-389 readings, and window drift is 12pp at 3 months / 29pp at 6 months. Units are incommensurable (share of bytes vs share of repo count) on a shared axis. The footer's "74 watching" is PAT-only (**public 27 / private 47**). And the left half restates the `languages` card.                                                                                                                                                |
| **`repositories` × contribution-type matrix**                        | reject        | 4 columns carry ~1.5 columns of information: COMMITS vs PRS **r = 0.930 (0.978 excluding the bot-committed profile repo)**, identical ramp levels on 6/10 rows. REVIEWS is one cell of value 1, and per-column normalisation paints it `contribRamp[4]` — the darkest ink on the card — next to a 379-commit cell. Its own safeguard (drop all-zero columns) does not fire. The stated rank-bias fix provably fails: ranking by any-contribution returns the same top-10, since every external repo scores exactly 1. Costs ~200px of the 408px bar. Salvage → **E6**.                                                                                                                                                                                                                                                                             |

### Vetted by inspection and not carried forward

- **`turnaround`** (PR time-to-merge ridgeline). The field works (`pullRequestContributions(first:100)`, cost 1 / nodeCount 100, 1,461 in the trailing year, median 17.6 min, p90 1,076 min) but the striking median is a **self-merge artifact** — the same 98.9%-own-repo population that killed `outcomes`. It is also a recency-biased 100-of-1,461 sample per year, viewer-scoped, and full coverage costs 15 points. Re-propose only with an external-repo-only population, which is n = 25 here.
- **`trajectory`** (bump chart of top repos per year). The explicit-window shape _is_ verified for one 12-month window (`contributionsCollection(from,to){commitContributionsByRepository(maxRepositories:25)}` → cost 1), but the **per-year fan-out over 12 historical windows is unverified**, bump charts go unreadable past ~8 lanes, renamed/deleted repos split one project into two lanes, and `isPrivate` filtering makes org-heavy years render as false inactivity. Revisit after N1 lands, if the deck still wants a second time series.
- **`pipeline`** (CI green rate) — **parked, not dead.** Zero GraphQL points, and GITHUB_TOKEN-safe by the strongest possible proof: `GET /repos/kovidgoyal/kitty/actions/runs?status=success` returned `total_count 7318` **with no token at all**. Blockers to resolve first: Dependabot and scheduled runs inflate both legs (needs `&event=push` and a documented filter), GitHub retains runs for a bounded window (~400 days, repo-configurable) so it is a recent rate not a lifetime one, a low green rate is self-criticism so it must be opt-in, and it introduces the first REST path into a GraphQL-only codebase (still zero-dependency — `fetch` is built in). 3 calls × 8 repos = 24 REST calls from the separate 5,000/hr bucket.

### API dead ends — do not re-propose

| Wanted                                                  | Status                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Achievements / trophies (Pull Shark, Starstruck, YOLO…) | **Not exposed anywhere.** Full schema introspection for achieve/badge/trophy hits only the unrelated `TextMatchHighlight`; `/users/{login}/achievements` → 404. HTML-scrape only.                                                                                                                                                                              |
| Follower growth over time                               | **Impossible.** `UserEdge` has `cursor` and `node` only — no `followedAt`. `followers.totalCount` is a point-in-time scalar. (Contrast `StargazerEdge.starredAt`, which exists but is admin-gated — see above.)                                                                                                                                                |
| Hour-of-day for PRs / issues / reviews / releases       | **Impossible.** `GitTimestamp` ("not converted in UTC") appears only on Git commit author/committer dates; every other timestamp is a UTC-normalised `DateTime` with the author's offset destroyed server-side. The `cadence` card's author-local trick cannot be extended.                                                                                    |
| Lines of code per language over time                    | **Impossible.** `Repository.languages` is a current snapshot with no historical variant and no `from`/`to`; commits carry `additions`/`deletions` with no language attribution; REST `/stats/code_frequency` is repo-wide and language-blind.                                                                                                                  |
| Per-author language share in repos you contributed to   | **Impossible.** `Repository.languages` returns the whole repo's mix. Any such card silently attributes other people's code to the user.                                                                                                                                                                                                                        |
| Repository traffic (views/clones) across repos          | **Blocked. Needs full `repo` scope**; `/traffic/views` on a non-owned repo → 403 "Must have push access". GITHUB_TOKEN has push only on the workflow's own repo, and the window is 14 days.                                                                                                                                                                    |
| `user.packages` detail                                  | **Red flag — requires `read:packages`.** `packages(first:5){nodes{name}}` → `INSUFFICIENT_SCOPES`. Only `packages{totalCount}` survives.                                                                                                                                                                                                                       |
| Sponsorship detail (amounts, tiers, timelines)          | **Red flag — requires `read:user`.** `sponsorshipsAsMaintainer{nodes{createdAt tier{…}}}` → `INSUFFICIENT_SCOPES`. The bare counters (`sponsors.totalCount`, `hasSponsorsListing`, `sponsorsListing{name activeGoal tiers.totalCount}`) do work scopelessly.                                                                                                   |
| GitHub Projects (profile-level)                         | **Red flag — requires `public_repo` + `read:project`.** Unreachable with a workflow token.                                                                                                                                                                                                                                                                     |
| Branch protection                                       | **Silently wrong — never use.** `Repository.branchProtectionRules` returns `totalCount 0` without admin rather than erroring (verified: `facebook/react` at READ → 0 rules). Use `Repository.rulesets`, which _is_ readable at READ (react 4, kitty 1).                                                                                                        |
| `user.issueComments.totalCount` and friends             | **Correctness trap.** Reads 1,334, but 97 of 100 sampled nodes came back FORBIDDEN/`saml_failure` — the total is dominated by org-private work GITHUB_TOKEN cannot count. Under the scheduled run those items are invisible rather than erroring. Never put a viewer-dependent number on a card without E2's disclosure, and never at all for `issueComments`. |
| Public events feed as a card source                     | **Too shallow.** 114 events / ~3 weeks; page 4 → HTTP 422; `PushEvent.payload.size` null in the public feed.                                                                                                                                                                                                                                                   |
| Per-author weekly churn                                 | **Unavailable.** REST `/stats/contributors` returns HTTP 202 `{}` persistently (3 retries over 12s, on large _and_ small repos). Its siblings `punch_card`, `code_frequency`, `participation` all return 200 — do not assume the `/stats` family behaves alike.                                                                                                |
| Intraday contribution calendar                          | **Day granularity only.** `ContributionCalendarDay` = `{color, contributionCount, contributionLevel, date, weekday}`; `weeks` accepts no `first`/`last`.                                                                                                                                                                                                       |
| `github.com/users/{login}/contributions`                | **Not an API** — `text/html`, unversioned, and the total is already derivable from the calendar we fetch.                                                                                                                                                                                                                                                      |
| Review latency / time-to-first-review                   | **Budget.** `PullRequestReview.submittedAt` exists but needs `reviews(first:N)` nested in a PR list — 15 points of PR pages plus a nested connection each, 50+ points. Cheap proxy that works: `pullRequest.reviews.totalCount`.                                                                                                                               |
| Organizations for private-only members                  | **Invisible by design.** Public memberships only; returns 0 for this account even with `read:org` while SAML errors prove substantial org activity. Renders empty and misrepresents the user.                                                                                                                                                                  |

---

## Suggested sequencing

| #                                                   | Item                                                                        | Kind                | Value | Effort | API cost                                      | Semver                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- | ----- | ------ | --------------------------------------------- | -------------------------------------------------- |
| **v1.3.0 — cost and honesty**                       |                                                                             |                     |       |        |                                               |
| 1                                                   | **I1** `pushedAt` sweep gate + `commit-sweep-limit` / `commit-sweep` inputs | infra + new inputs  | ★★★★★ | M      | **−30ish points** (44 → ~14 for this account) | **minor** (new inputs; default 0 preserves output) |
| 2                                                   | **E2** private-contribution + window disclosure line                        | rendering           | ★★★★☆ | S      | free (selections on an existing connection)   | patch                                              |
| 3                                                   | **E7** numeric ramp legend + `legend: ramp\|scale` input                    | rendering + input   | ★★★★☆ | S      | zero                                          | **minor**                                          |
| 4                                                   | **E3** `languages(first:30)` + `totalSize`/`totalCount`, exact "Other"      | correctness         | ★★★★☆ | S      | free (replaces a selection)                   | **minor** (percentages change)                     |
| **v1.4.0 — the deck’s first line chart**            |                                                                             |                     |       |        |                                               |
| 5                                                   | **N1** `momentum` card                                                      | new card            | ★★★★★ | M      | **zero**                                      | **minor**                                          |
| 6                                                   | **E4** `overview` sparklines + YTD delta chip                               | rendering           | ★★★★☆ | M      | zero                                          | **minor** (tile height 94 → 108)                   |
| **v1.5.0 — unflatten the per-repository dimension** |                                                                             |                     |       |        |                                               |
| 7                                                   | **N2** `portfolio` card                                                     | new card            | ★★★★☆ | L      | +0–2 points, no new request                   | **minor**                                          |
| 8                                                   | **E3b** language reach column + unit strip                                  | rendering           | ★★★☆☆ | M      | zero (uses E3's data)                         | **minor**                                          |
| **v1.6.0 — sharpen what exists**                    |                                                                             |                     |       |        |                                               |
| 9                                                   | **E5** `cadence` commit-size strip (+ `changedFilesIfAvailable`)            | rendering           | ★★★★☆ | M      | free (selection on `COMMITS_QUERY`)           | **minor** (card grows ~62px)                       |
| 10                                                  | **E6** `repositories` ISSUES column + popular-PR caption                    | rendering           | ★★★☆☆ | S      | free (`{cost:1, nodeCount:4}` measured)       | **minor**                                          |
| 11                                                  | **E8** `rhythm` lifetime-vs-trailing dumbbell                               | rendering           | ★★★☆☆ | M      | zero                                          | **minor** (units change to share)                  |
| 12                                                  | **E9** `repositories` lifetime bullet track                                 | rendering + 1 query | ★★★☆☆ | M      | +1 point _(gated on a probe)_                 | **minor**                                          |
| **Parked**                                          |                                                                             |                     |       |        |                                               |
| —                                                   | `pipeline` (CI green rate)                                                  | new card, opt-in    | ★★★☆☆ | L      | 0 GraphQL, 24 REST calls                      | minor, when unblocked                              |
| —                                                   | `trajectory` (bump chart)                                                   | new card            | ★★☆☆☆ | L      | free _(per-year windows unverified)_          | minor, if ever                                     |

Two rules for the sequence. **I1 ships before anything that reads `commits[]`** (E5) so the disclosure and the cost fix land together rather than the card being made load-bearing on an unbounded query. **E2 ships before E4**, because a delta chip on a viewer-scoped counter without the provenance line is exactly the failure mode that sank `outcomes`.
