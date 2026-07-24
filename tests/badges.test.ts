import { siGithub } from 'simple-icons';
import { describe, expect, it } from 'vitest';
import { renderBadges } from '../src/badges.js';
import { DARK, LIGHT, THEMES } from '../src/theme.js';
import { assertWellFormed } from './xml.js';

describe('renderBadges', () => {
  it('renders the brand glyph for a name present in simple-icons, in both themes', () => {
    const badges = renderBadges(['GitHub'], THEMES);
    for (const theme of THEMES) {
      const svg = badges.get(`github.${theme.id}.svg`);
      expect(svg, `missing github.${theme.id}.svg`).toBeDefined();
      assertWellFormed(svg ?? '');
      // The exact simple-icons geometry proves the icon (not a placeholder) was drawn.
      expect(svg).toContain('<path');
      expect(svg).toContain(`d="${siGithub.path}"`);
      // The label is the name exactly as given.
      expect(svg).toContain('aria-label="GitHub"');
    }
  });

  it('slugs multi-word names for the filename (Maven Central -> maven-central) and renders text-only', () => {
    const badges = renderBadges(['Maven Central'], THEMES);
    for (const id of [LIGHT.id, DARK.id]) {
      const svg = badges.get(`maven-central.${id}.svg`);
      expect(svg, `missing maven-central.${id}.svg`).toBeDefined();
      assertWellFormed(svg ?? '');
      // No such icon in simple-icons -> a text-only pill carries no <path>.
      expect(svg).not.toContain('<path');
      expect(svg).toContain('aria-label="Maven Central"');
    }
  });

  it('renders an unknown brand as a text-only pill with a correctly slugged filename', () => {
    const badges = renderBadges(['Findy'], THEMES);
    for (const id of [LIGHT.id, DARK.id]) {
      const svg = badges.get(`findy.${id}.svg`);
      expect(svg, `missing findy.${id}.svg`).toBeDefined();
      assertWellFormed(svg ?? '');
      expect(svg).not.toContain('<path');
    }
  });

  it('preserves single-token names verbatim in the slug (npm -> npm)', () => {
    const badges = renderBadges(['npm'], THEMES);
    expect(badges.has(`npm.${LIGHT.id}.svg`)).toBe(true);
    expect(badges.has(`npm.${DARK.id}.svg`)).toBe(true);
  });

  it('produces names.length x themes.length entries', () => {
    const names = ['GitHub', 'Findy', 'Maven Central', 'npm'];
    const badges = renderBadges(names, THEMES);
    expect(badges.size).toBe(names.length * THEMES.length);
  });

  it('resolves the icon case-insensitively (github == GitHub)', () => {
    const lower = renderBadges(['github'], THEMES).get(`github.${LIGHT.id}.svg`);
    const canonical = renderBadges(['GitHub'], THEMES).get(`github.${LIGHT.id}.svg`);
    expect(lower).toBeDefined();
    expect(canonical).toBeDefined();
    // Same underlying icon geometry for both spellings.
    expect(lower).toContain(`d="${siGithub.path}"`);
    expect(canonical).toContain(`d="${siGithub.path}"`);
  });
});
