/** Depth effects: same-hue bar fades and the per-mode effect budget. */

import { describe, expect, it } from 'vitest';
import { barPaint, effectDefs, MIN_FADE_LENGTH } from '../src/svg/effects.js';
import { DARK, LIGHT, luminance, oklchLightness, shiftLightness } from '../src/theme.js';

describe('shiftLightness', () => {
  it('lightens and darkens without leaving the hue family', () => {
    const green = '#216e39';
    const lighter = shiftLightness(green, 0.1);
    const darker = shiftLightness(green, -0.1);
    expect(luminance(lighter)).toBeGreaterThan(luminance(green));
    expect(luminance(darker)).toBeLessThan(luminance(green));
    // Still green: the green channel dominates both results.
    for (const color of [lighter, darker]) {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
      expect(g, color).toBeGreaterThan(r ?? 0);
      expect(g, color).toBeGreaterThan(b ?? 0);
    }
  });

  it('is the identity at zero and stays in gamut at the extremes', () => {
    expect(shiftLightness('#216e39', 0)).toBe('#216e39');
    expect(shiftLightness('#ffffff', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(shiftLightness('#000000', -0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('barPaint', () => {
  it('maps a long ramp-colored bar to its gradient and leaves other colors solid', () => {
    expect(barPaint(LIGHT, LIGHT.contribRamp[4], 'x', 200)).toBe('url(#bar-x-4)');
    expect(barPaint(DARK, DARK.contribRamp[2], 'y', MIN_FADE_LENGTH)).toBe('url(#bar-y-2)');
    expect(barPaint(LIGHT, '#123456', 'x', 200)).toBe('#123456');
  });

  it('keeps short bars solid, where a fade would compress into a blotch', () => {
    expect(barPaint(LIGHT, LIGHT.contribRamp[4], 'x', MIN_FADE_LENGTH - 1)).toBe(LIGHT.contribRamp[4]);
  });

  it('never fades a base toward the track past the clearance', () => {
    for (const theme of [LIGHT, DARK]) {
      const defs = effectDefs(theme);
      const track = oklchLightness(theme.track);
      for (const level of [1, 2, 3, 4]) {
        const base =
          new RegExp(`<linearGradient id="bar-x-${level}"[^>]*><stop offset="0" stop-color="(#[0-9a-f]{6})"`).exec(
            defs
          )?.[1] ?? '';
        // A step already closer than the clearance stays where it is.
        const own = Math.abs(oklchLightness(theme.contribRamp[level] ?? '') - track);
        expect(Math.abs(oklchLightness(base) - track), `${theme.id} level ${level}`).toBeGreaterThanOrEqual(
          Math.min(0.1, own) - 0.001
        );
      }
    }
  });

  it('ends every bar gradient on the exact ramp color', () => {
    for (const theme of [LIGHT, DARK]) {
      const defs = effectDefs(theme);
      for (const [level, color] of theme.contribRamp.entries()) {
        for (const axis of ['x', 'y']) {
          expect(defs, `${theme.id} ${axis}${level}`).toMatch(
            new RegExp(`<linearGradient id="bar-${axis}-${level}"[^>]*>.*?<stop offset="1" stop-color="${color}"`)
          );
        }
      }
    }
  });
});
