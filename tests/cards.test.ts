/** Render every card in both themes and assert the shared SVG contract. */

import { describe, expect, it } from 'vitest';
import { renderCard } from '../src/cards.js';
import { computeStreaks } from '../src/compute/streaks.js';
import { resolveFonts } from '../src/fonts.js';
import type { ProfileData, Streaks } from '../src/model.js';
import { DARK, LIGHT, PALETTE_IDS, THEMES, themeFor } from '../src/theme.js';
import { makeFixture } from './fixture.js';
import { assertWellFormed } from './xml.js';

const CARDS = [
  'overview',
  'momentum',
  'contributions',
  'lifetime',
  'composition',
  'rhythm',
  'cadence',
  'repositories',
  'portfolio',
  'languages',
];

const data: ProfileData = makeFixture();
const streaks: Streaks = computeStreaks(data.lifetimeDays);
// The default families read pre-subset constants — no network.
const fontFaceCss: string = await resolveFonts('Roboto', 'Roboto Mono');

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

  it('renders a valid empty-state cadence card when the sweep found no commits', () => {
    const svg = renderCard('cadence', { ...data, commits: [] }, streaks, LIGHT, fontFaceCss);
    assertWellFormed(svg);
    expect(svg).toContain('>0</tspan> commits');
    expect(svg).not.toContain('peak');
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

  it('never sets the opacity or transform attributes the reduced-motion reset overrides', () => {
    // The reset forces `opacity:1` and `transform:none` on every element, and
    // both CSS properties beat their presentation attributes: a tint would turn
    // solid and a transformed group would snap to the origin.
    for (const { name, svg } of renderAll()) {
      expect(svg, name).not.toMatch(/ (opacity|transform)="/);
    }
  });

  it('defines the area fade with stop-opacity in every card', () => {
    for (const { name, svg } of renderAll()) {
      expect(svg, name).toMatch(
        /<linearGradient id="area"[^>]*><stop offset="0" stop-color="#[0-9a-f]{6}" stop-opacity="0.32"\/>/
      );
    }
  });

  it('heads every card with an icon and an uppercase eyebrow in the palette ink', () => {
    for (const theme of PALETTE_IDS.flatMap((palette) => [themeFor('light', palette), themeFor('dark', palette)])) {
      for (const card of CARDS) {
        const svg = renderCard(card, data, streaks, theme, fontFaceCss);
        const name = `${card}.${theme.palette}.${theme.id}`;
        assertWellFormed(svg);
        expect(svg, name).toMatch(/<svg x="24" y="31" width="15" height="15" viewBox="0 0 24 24"/);
        expect(svg, name).toMatch(new RegExp(`\\.t-title\\{font-family:'CardMono'[^}]*fill:${theme.ink}\\}`));
        const eyebrow = /class="t-title">([^<]*)</.exec(svg)?.[1] ?? '';
        expect(eyebrow, name).toBe(eyebrow.toUpperCase());
        expect(eyebrow.length, name).toBeGreaterThan(0);
      }
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

describe('private-contribution disclosure', () => {
  /** The calendar-derived cards and the flag each one reads. */
  const CALENDAR_CARDS = ['lifetime', 'contributions', 'composition'];

  function notesFor(profile: ProfileData): string[] {
    return CALENDAR_CARDS.map((card) => renderCard(card, profile, streaks, LIGHT, fontFaceCss));
  }

  it('says private work is counted when it is', () => {
    for (const svg of notesFor(data)) {
      expect(svg).toContain('INCL. PRIVATE');
      expect(svg).not.toContain('PUBLIC ONLY');
    }
  });

  it('says the count is public-only when no private work is included', () => {
    const publicOnly: ProfileData = {
      ...data,
      includesPrivate: false,
      trailing: { ...data.trailing, includesPrivate: false },
      years: data.years.map((year) => ({ ...year, restricted: 0 })),
    };
    for (const svg of notesFor(publicOnly)) {
      expect(svg).toContain('PUBLIC ONLY');
      expect(svg).not.toContain('INCL. PRIVATE');
    }
  });
});
