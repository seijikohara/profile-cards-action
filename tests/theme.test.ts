/** Palette contracts: every palette must be as legible as GitHub's own green. */

import { describe, expect, it } from 'vitest';
import { contrast, DARK, LIGHT, luminance, PALETTE_IDS, themeFor, type Theme } from '../src/theme.js';

const MODES: readonly Theme['id'][] = ['light', 'dark'];

describe('palettes', () => {
  it('keeps green as the historical light and dark themes', () => {
    expect(themeFor('light', 'green')).toEqual(LIGHT);
    expect(themeFor('dark', 'green')).toEqual(DARK);
  });

  it('sets eyebrow and headline inks at text contrast on the card background', () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of MODES) {
        const theme = themeFor(mode, palette);
        expect(contrast(theme.ink, theme.bg), `${palette}.${mode} ink`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.inkAlt, theme.bg), `${palette}.${mode} inkAlt`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('shares the empty level across palettes, so a blank day looks the same in all of them', () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of MODES) {
        expect(themeFor(mode, palette).contribRamp[0]).toBe(themeFor(mode, 'green').contribRamp[0]);
      }
    }
  });

  it('steps every ramp monotonically away from the background', () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of MODES) {
        const lums = themeFor(mode, palette).contribRamp.map(luminance);
        for (const [level, lum] of lums.entries()) {
          if (level === 0) continue;
          const previous = lums[level - 1] ?? Number.NaN;
          // Light ramps darken toward "more"; dark ramps brighten.
          if (mode === 'light') expect(lum, `${palette}.${mode}[${level}]`).toBeLessThan(previous);
          else expect(lum, `${palette}.${mode}[${level}]`).toBeGreaterThan(previous);
        }
      }
    }
  });

  it("matches green's contrast at every level within 15%, so green-tuned rules hold", () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of MODES) {
        const theme = themeFor(mode, palette);
        const green = themeFor(mode, 'green');
        for (const [level, color] of theme.contribRamp.entries()) {
          const ratio = contrast(color, theme.bg) / contrast(green.contribRamp[level] ?? '', green.bg);
          expect(Math.abs(ratio - 1), `${palette}.${mode}[${level}]`).toBeLessThan(0.15);
        }
      }
    }
  });
});
