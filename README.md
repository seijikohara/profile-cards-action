# Profile Cards Action

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/seijikohara/profile-cards-action)](https://github.com/seijikohara/profile-cards-action/releases)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/seijikohara/profile-cards-action/ci.yaml)](https://github.com/seijikohara/profile-cards-action/actions)
[![License](https://img.shields.io/github/license/seijikohara/profile-cards-action)](LICENSE)

A GitHub Action that renders profile README cards as SVG from the GitHub GraphQL API. It produces an overview card, contribution history, streaks, language composition, activity rhythm, and a language treemap, and can commit the generated files back to your repository.

> **Status:** Skeleton. The action currently ships a stub entry point and does not render cards yet.

## Overview

Profile READMEs usually rely on third-party image services that fetch your stats on every page view. This action renders the cards itself inside your own workflow and writes plain SVG files into your repository, so the images are self-hosted, reproducible, and theme-aware (light and dark).

Each requested card is rendered per theme into `<output-dir>/`. Optional badge pills are rendered into `<output-dir>/badges/`, using [simple-icons](https://simpleicons.org/) for brand glyphs when a match exists and falling back to text-only pills otherwise.

## Usage

```yaml
name: Profile Cards

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  cards:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Render profile cards
        uses: seijikohara/profile-cards-action@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          username: seijikohara
          cards: overview,lifetime,contributions,composition,rhythm,languages
          output-dir: assets
          themes: light,dark
          commit: true
```

`actions/checkout` must run first so the action can read the working tree and commit generated files back to it.

## Inputs

| Input            | Description                                                                                                                                       | Required | Default                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `github-token`   | Token for the GitHub GraphQL API and, when committing, for pushing generated files.                                                               | `true`   | —                                                              |
| `username`       | GitHub login to render. Defaults to the repository owner (`GITHUB_REPOSITORY_OWNER`).                                                             | `false`  | `''`                                                           |
| `cards`          | Cards to render (comma/space/newline separated).                                                                                                  | `false`  | `overview,lifetime,contributions,composition,rhythm,languages` |
| `output-dir`     | Directory to write card SVGs into.                                                                                                                | `false`  | `assets`                                                       |
| `themes`         | Themes to render (comma separated): `light`, `dark`.                                                                                              | `false`  | `light,dark`                                                   |
| `font`           | Google Fonts sans-serif family. Roboto and Roboto Mono are bundled; other families are fetched at runtime.                                        | `false`  | `Roboto`                                                       |
| `mono-font`      | Google Fonts monospace family.                                                                                                                    | `false`  | `Roboto Mono`                                                  |
| `badges`         | Newline-separated brand names to render as badge pills (icon via simple-icons when available, else text-only). Written to `<output-dir>/badges/`. | `false`  | `''`                                                           |
| `commit`         | Commit changed files back to the repository.                                                                                                      | `false`  | `true`                                                         |
| `commit-message` | Commit subject used when `commit` is true.                                                                                                        | `false`  | `chore(profile): refresh generated cards [skip ci]`            |

## Outputs

| Output    | Description                                              |
| --------- | -------------------------------------------------------- |
| `changed` | Whether any generated file changed (`"true"`/`"false"`). |
| `files`   | JSON array of written file paths.                        |

## How It Works

1. **Fetch** — Query the GitHub GraphQL API for the target user's profile, contribution calendar, and repository language statistics.
2. **Render** — Draw each requested card to SVG for every requested theme, subsetting fonts (via `subset-font`) so only the glyphs actually used are embedded.
3. **Write** — Emit the SVGs into `output-dir` (and any badge pills into `output-dir/badges/`).
4. **Commit** — When `commit` is enabled, commit and push the changed files using `commit-message`, and report `changed` / `files` outputs.

> This section describes the intended behavior. Rendering is not implemented yet.

## License

This project is licensed under the [MIT License](LICENSE).
