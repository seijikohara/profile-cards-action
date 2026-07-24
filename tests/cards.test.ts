/** Render every card in both themes and assert the shared SVG contract. */

import { beforeAll, describe, expect, it } from 'vitest';
import { renderCard } from '../src/cards.js';
import { computeStreaks } from '../src/compute/streaks.js';
import { resolveFonts } from '../src/fonts.js';
import type { ProfileData, Streaks } from '../src/model.js';
import { DARK, LIGHT, THEMES } from '../src/theme.js';
import { makeFixture } from './fixture.js';
import { assertWellFormed } from './xml.js';

const CARDS = ['overview', 'lifetime', 'contributions', 'composition', 'rhythm', 'languages'];

let data: ProfileData;
let streaks: Streaks;
let fontFaceCss: string;

beforeAll(async () => {
  data = makeFixture();
  streaks = computeStreaks(data.lifetimeDays);
  // The default families read pre-subset constants — no network.
  fontFaceCss = await resolveFonts('Roboto', 'Roboto Mono');
});

/** Render the full CARDS × THEMES matrix through the public dispatcher. */
function renderAll(): { name: string; svg: string }[] {
  return THEMES.flatMap((theme) =>
    CARDS.map((card) => ({
      name: `${card}.${theme.id}`,
      svg: renderCard(card, data, streaks, theme, fontFaceCss),
    }))
  );
}

describe('card rendering', () => {
  it('produces well-formed SVG for every card in both themes', () => {
    for (const { name, svg } of renderAll()) {
      expect(svg.startsWith('<svg '), `${name} starts with <svg`).toBe(true);
      assertWellFormed(svg);
    }
  });

  it('is deterministic for identical input', () => {
    const first = renderAll();
    const second = renderAll();
    for (const [index, card] of first.entries()) {
      expect(second[index]?.svg).toBe(card.svg);
    }
  });

  it('contains no scripts, external references, or foreignObject', () => {
    for (const { name, svg } of renderAll()) {
      // Vet the embedded-font data URIs out of the scan: their Base64 payload is
      // reviewed binary, not authored markup, and could coincidentally contain a
      // banned substring. The single xmlns namespace declaration is expected.
      const body = svg.replace('xmlns="http://www.w3.org/2000/svg"', '').replaceAll(/url\(data:[^)]*\)/g, 'url(data:)');
      for (const banned of ['<script', 'http://', 'https://', 'url(http', '<foreignObject', 'href=']) {
        expect(body.includes(banned), `${name} must not contain ${banned}`).toBe(false);
      }
    }
  });

  it('declares the profile column width and an accessible label', () => {
    for (const { name, svg } of renderAll()) {
      expect(svg, name).toContain('viewBox="0 0 846 ');
      expect(svg, name).toContain('role="img"');
      expect(svg, name).toContain('aria-label=');
    }
  });

  it('respects reduced motion in every card', () => {
    for (const { name, svg } of renderAll()) {
      expect(svg, name).toContain('prefers-reduced-motion');
    }
  });

  it('embeds the resolved card font in every card', () => {
    for (const { name, svg } of renderAll()) {
      expect(svg, name).toContain('@font-face');
      expect(svg, name).toContain("font-family:'CardSans'");
    }
  });

  it('retitles the lifetime card instead of reusing "Contributions"', () => {
    const svg = renderCard('lifetime', data, streaks, DARK, fontFaceCss);
    expect(svg).toContain('Contribution history');
    expect(svg).not.toContain('>Contributions<');
  });

  it('names every fixture language with its percentage share', () => {
    const svg = renderCard('languages', data, streaks, LIGHT, fontFaceCss);
    for (const name of ['TypeScript', 'Kotlin', 'Java']) {
      expect(svg, name).toContain(name);
    }
    expect(svg).toContain('%');
  });
});
