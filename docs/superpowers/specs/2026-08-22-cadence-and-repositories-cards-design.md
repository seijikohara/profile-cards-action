# Cadence and Repositories Cards

- **Date:** 2026-08-22
- **Status:** Approved
- **Scope:** Two new cards (`cadence`, `repositories`), a footer enrichment for the `rhythm` card, and the commit sweep that powers them.

## Background

Every existing card derives from `contributionsCollection`, whose finest granularity is one day. The GraphQL schema exposes no hour-of-day field on any contribution object (verified by introspection on 2026-08-22). Time-of-day data therefore needs commit-level timestamps.

### Data-source decision

| Source                                  | Verdict    | Reason                                                                                                 |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| REST events API                         | Rejected   | Only the past 30 days and at most 300 events ([docs](https://docs.github.com/en/rest/activity/events)) |
| REST repo punch-card statistics         | Rejected   | Per-repository, all authors mixed; cannot isolate one user                                             |
| GraphQL `Commit.history(author, since)` | **Chosen** | Filters to the user, bounds the window, and exposes offset-preserving timestamps                       |

The load-bearing fact: `GitActor.date` is a `GitTimestamp` — "Unlike the DateTime type, GitTimestamp is not converted in UTC" (schema description). A live probe returned `2026-08-17T08:14:07+09:00` for the user's own commits, so the clock-face fields of the string are the author's local time. No `timezone` input is needed. `Commit.authoredDate`/`committedDate` are `DateTime` (UTC-normalized) and must NOT be used.

Known skew, documented in the README: commits created through the GitHub web UI (merge button, web edits) are recorded with a UTC offset and land in UTC hour buckets.

## Commit sweep

One new query, paginated per repository, fanned out with `Promise.all` like the per-year queries:

```graphql
query Commits($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(author: { id: $authorId }, since: $since, first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              author {
                date
              }
              additions
              deletions
            }
          }
        }
      }
    }
  }
}
```

- Targets: owned, public, non-fork, non-archived repositories — the same population the languages card aggregates. `PROFILE_QUERY` gains `user.id` (the author filter) and repository `name`.
- Window: trailing 365 days from run time, matching the trailing calendar's story.
- Default branch only; merge commits are not filtered out (v1 simplification).
- Cost: 1 point per page; the reference profile is ~40 repositories × 1–4 pages. Empty repositories (`defaultBranchRef` null) are skipped.
- Commits whose `author.date` is null are dropped defensively.

## Model

`ProfileData` gains:

- `commits: readonly CommitSample[]` where `CommitSample = { date, additions, deletions }` and `date` keeps the raw offset-bearing ISO string.
- `topRepositories: readonly RepoCommits[]` (PR 2) where `RepoCommits = { nameWithOwner, commits }`.

## compute/cadence.ts

Pure and clock-free. Parses the local clock-face fields (`YYYY-MM-DD` and hour) directly from the ISO string with a regex — going through `Date` would re-normalize to UTC, which is exactly what the offset-preserving string avoids. Malformed dates throw.

Output:

- `grid[7][24]` — commit counts, rows Monday..Sunday (matching `rhythm` and `lifetime`), columns hour 0..23.
- `levels[7][24]` — 0..4 per cell, quantile-leveled over the non-zero cell distribution exactly like `lifetime`'s weekly leveling.
- `peak` — the max cell (`undefined` when there are no commits).
- `totalCommits`, `additions`, `deletions`.

## cadence card

Punch card: 24 columns × 7 rows of dots inside the standard 846px frame.

- Dot radius and fill scale with level; fills use `theme.contribRamp`; the peak cell uses `theme.accent`.
- Hour ticks every 2 hours; weekday labels Mon..Sun on the left, mirroring `rhythm`.
- Footer stat line: `N commits · peak Wed 10:00 · +X −Y lines` with `compact()` magnitudes.
- Frame note: `trailing 12 months · author local time`.
- Entry animation: staggered fade per column, disabled under `prefers-reduced-motion` (frame default).
- Zero-commit input renders a valid card with an all-level-0 grid and `0 commits`.

## repositories card (PR 2)

Top 10 repositories by commits over the trailing year, from `contributionsCollection.commitContributionsByRepository(maxRepositories: 10)` added to `TRAILING_QUERY`. Commit counts sum `commitCount` over the paginated `contributions` nodes; client-side sort descending. Includes repositories the user does not own, so OSS contributions surface. Rendered as ranked horizontal bars, `nameWithOwner` labels, top bar in accent.

## rhythm footer (PR 2)

One stat line derived from data already fetched (`lifetimeDays`, zero new queries): active-day rate (active days ÷ total days), busiest day (date + count), weekend share of contributions.

## Interface changes

- `KNOWN_CARDS` order becomes `overview, lifetime, contributions, composition, rhythm, cadence, languages` (PR 1), then `…, cadence, repositories, languages` (PR 2 inserts `repositories` after `cadence`).
- `action.yml` `cards` default, README card table + examples, and `.github/workflows/examples.yml` (explicit card list) gain the new names.
- Additive change: consumers reference generated files explicitly, so extra outputs break nothing. Release stays on the automatic patch reconciler (0.x convention; strict semver at v1).

## Testing

- TDD for `compute/cadence` (offset parsing `+09:00`/`Z`/negative, hour bucketing, leveling, peak, empty input, malformed throw) and the PR 2 computes.
- `tests/fixture.ts` gains deterministic seeded synthetic commits; `cards.test.ts` matrix covers the new cards in both themes with well-formedness checks.
- Real-API integration stays with `test-action.yml` (`uses: ./`), which renders the default card set on every PR.

## Rollout

1. PR 1: sweep + `cadence` card (includes the code-volume footer).
2. PR 2: `repositories` card + `rhythm` footer.
3. After the reconciler releases and `v0` moves: add the new cards to the profile repository's README and workflow (consumer side).
