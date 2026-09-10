import { describe, expect, it } from 'vitest';
import { renderPortfolio } from '../src/cards/portfolio.js';
import type { PortfolioRepo, ProfileData } from '../src/model.js';
import { LIGHT } from '../src/theme.js';
import { makeFixture } from './fixture.js';
import { assertWellFormed } from './xml.js';

const data: ProfileData = makeFixture();

function withRepos(repos: readonly PortfolioRepo[]): ProfileData {
  return { ...data, repositories: repos };
}

describe('renderPortfolio', () => {
  it('draws one lifeline per repository, capped at twelve', () => {
    const svg = renderPortfolio(data, LIGHT, '');
    assertWellFormed(svg);
    expect(svg.match(/class="life"/g)).toHaveLength(Math.min(12, data.repositories.length));
  });

  it('says how many repositories it left out', () => {
    const svg = renderPortfolio(data, LIGHT, '');
    expect(svg).toContain(data.repositories.length > 12 ? 'top 12 shown' : 'source repositories');
  });

  it('renders a self-explanatory stub with nothing to plot', () => {
    const svg = renderPortfolio(withRepos([]), LIGHT, '');
    assertWellFormed(svg);
    expect(svg).toContain('No public source repositories');
  });

  it('marks an empty repository without drawing a zero-length bar', () => {
    const empty: PortfolioRepo = {
      nameWithOwner: 'octocat/empty',
      createdAt: '2025-01-01T00:00:00Z',
      pushedAt: null,
      commits: 0,
      language: null,
      stars: 0,
      diskUsageKb: 0,
      license: null,
    };
    const svg = renderPortfolio(withRepos([empty]), LIGHT, '');
    assertWellFormed(svg);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<rect x="268"');
  });

  it('shows an em dash where a repository carries no license', () => {
    const unlicensed: PortfolioRepo = {
      nameWithOwner: 'octocat/plain',
      createdAt: '2024-01-01T00:00:00Z',
      pushedAt: '2026-01-01T00:00:00Z',
      commits: 12,
      language: null,
      stars: 0,
      diskUsageKb: 10,
      license: null,
    };
    expect(renderPortfolio(withRepos([unlicensed]), LIGHT, '')).toContain('>—<');
  });

  it('never calls push recency health, and says whose pushes count', () => {
    const svg = renderPortfolio(data, LIGHT, '');
    expect(svg).toContain('pushed recently, any author');
    expect(svg.toLowerCase()).not.toContain('health');
    expect(svg.toLowerCase()).not.toContain('stale');
  });
});
