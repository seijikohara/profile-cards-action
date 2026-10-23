/** Render every card in both themes and assert the shared SVG contract. */

import { describe, expect, it } from 'vitest';
import { renderCard, renderCombined } from '../src/cards.js';
import { computeStreaks } from '../src/compute/streaks.js';
import { resolveFonts } from '../src/fonts.js';
import type { ProfileData, Streaks } from '../src/model.js';
import { DARK, LIGHT, PALETTE_IDS, THEMES, type Theme, themeFor } from '../src/theme.js';
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

  it('defines every paint server and filter a card references', () => {
    // A dangling url(#id) paints nothing at all: a bar or a tile would vanish.
    for (const { name, svg } of renderAll()) {
      const ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]));
      const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);
      for (const ref of refs) expect(ids.has(ref), `${name} -> #${ref}`).toBe(true);
    }
  });

  it('keeps glow on the dark canvas and shadow on the light one', () => {
    expect(renderCard('momentum', data, streaks, DARK, fontFaceCss)).toContain('filter="url(#glow-blur)"');
    expect(renderCard('momentum', data, streaks, LIGHT, fontFaceCss)).not.toContain('filter="url(#glow-blur)"');
    expect(renderCard('overview', data, streaks, LIGHT, fontFaceCss)).toContain('filter="url(#lift)"');
    expect(renderCard('overview', data, streaks, DARK, fontFaceCss)).not.toContain('filter="url(#lift)"');
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

/** Height a standalone document declares in its viewBox. */
function heightOf(svg: string): number {
  return Number(/viewBox="0 0 846 ([\d.]+)"/.exec(svg)?.[1]);
}

/** Every eyebrow title in document order. */
function eyebrowsOf(svg: string): string[] {
  return [...svg.matchAll(/class="t-title">([^<]*)</g)].map((match) => match[1] ?? '');
}

/** The hairlines drawn between neighbouring cards. */
function hairlinesOf(svg: string, theme: Theme): string[] {
  return [
    ...svg.matchAll(new RegExp(`<rect x="24" y="[\\d.]+" width="798" height="1" fill="${theme.borderMuted}"/>`, 'g')),
  ].map((match) => match[0]);
}

describe('combined layout', () => {
  it('stacks every card into one well-formed document as tall as the cards together', () => {
    for (const theme of THEMES) {
      const svg = renderCombined(CARDS, data, streaks, theme, fontFaceCss);
      assertWellFormed(svg);
      const height = CARDS.reduce(
        (sum, card) => sum + heightOf(renderCard(card, data, streaks, theme, fontFaceCss)),
        0
      );
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 846 ${height}"`), theme.id).toBe(
        true
      );
    }
  });

  it('stacks the cards in the order requested', () => {
    const order = ['languages', 'overview', 'rhythm'];
    const svg = renderCombined(order, data, streaks, LIGHT, fontFaceCss);
    expect(eyebrowsOf(svg)).toEqual(
      order.flatMap((card) => eyebrowsOf(renderCard(card, data, streaks, LIGHT, fontFaceCss)))
    );
  });

  it('embeds the fonts and definitions once', () => {
    const single = renderCard('overview', data, streaks, DARK, fontFaceCss);
    const svg = renderCombined(CARDS, data, streaks, DARK, fontFaceCss);
    expect(svg.split('@font-face').length).toBe(single.split('@font-face').length);
    // A repeated id resolves to whichever copy comes first, so the copies
    // must not exist at all rather than merely agree.
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the paint, filter, and reduced-motion contracts of a single card', () => {
    for (const theme of THEMES) {
      const svg = renderCombined(CARDS, data, streaks, theme, fontFaceCss);
      const ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]));
      for (const ref of [...svg.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1])) {
        expect(ids.has(ref), `${theme.id} -> #${ref}`).toBe(true);
      }
      expect(svg, theme.id).not.toMatch(/ (opacity|transform)="/);
      expect(svg, theme.id).toContain('prefers-reduced-motion');
    }
  });

  it('draws one canvas and one hairline between each pair of neighbours', () => {
    for (const theme of THEMES) {
      const svg = renderCombined(CARDS, data, streaks, theme, fontFaceCss);
      expect(svg.split(`fill="${theme.bg}" stroke="${theme.border}"`).length - 1, theme.id).toBe(1);
      expect(svg.split('fill="url(#glow)"').length - 1, theme.id).toBe(theme.id === 'dark' ? 1 : 0);
      expect(hairlinesOf(svg, theme), theme.id).toHaveLength(CARDS.length - 1);
    }
    expect(hairlinesOf(renderCombined(['overview'], data, streaks, LIGHT, fontFaceCss), LIGHT)).toHaveLength(0);
  });

  it('refuses an empty card list', () => {
    expect(() => renderCombined([], data, streaks, LIGHT, fontFaceCss)).toThrow(/at least one card/);
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
