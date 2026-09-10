import { describe, expect, it } from 'vitest';
import { barFill, privacyNote, rampLegend, rampLegendWidth } from '../src/cards/legend.js';
import { DARK, LIGHT } from '../src/theme.js';
import { assertWellFormed } from './xml.js';

describe('barFill', () => {
  it('reserves level 0 for an empty value', () => {
    expect(barFill(LIGHT, 0, 100)).toBe(LIGHT.contribRamp[0]);
    expect(barFill(LIGHT, 5, 0)).toBe(LIGHT.contribRamp[0]);
  });

  it('splits the series into the ramp top three steps', () => {
    expect(barFill(LIGHT, 100, 100)).toBe(LIGHT.contribRamp[4]);
    expect(barFill(LIGHT, 50, 100)).toBe(LIGHT.contribRamp[3]);
    expect(barFill(LIGHT, 1, 100)).toBe(LIGHT.contribRamp[2]);
  });

  it('never reaches the ramp step that vanishes on the dark canvas', () => {
    const fills = Array.from({ length: 101 }, (_, value) => barFill(DARK, value, 100));
    expect(fills).not.toContain(DARK.contribRamp[1]);
  });
});

describe('rampLegend', () => {
  it('draws one swatch per ramp step between the two captions', () => {
    const svg = rampLegend(LIGHT, 0, 100);
    assertWellFormed(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    for (const color of LIGHT.contribRamp) expect(svg).toContain(`fill="${color}"`);
    expect(svg.match(/<rect /g)).toHaveLength(LIGHT.contribRamp.length);
    expect(svg).toContain('>Less<');
    expect(svg).toContain('>More<');
  });

  it('keeps the closing caption inside the reported width', () => {
    const more = /x="([\d.]+)"[^>]*class="t-tick"[^>]*>More</.exec(rampLegend(LIGHT, 0, 100));
    expect(more).not.toBeNull();
    expect(Number(more?.[1])).toBeLessThan(rampLegendWidth());
  });

  it('grows with the swatch pitch', () => {
    expect(rampLegendWidth({ pitch: 18 })).toBeGreaterThan(rampLegendWidth({ pitch: 14 }));
  });

  it('takes a custom swatch shape', () => {
    const svg = rampLegend(LIGHT, 0, 100, {
      pitch: 18,
      swatch: (color, _level, cx, cy) => `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>`,
    });
    expect(svg).not.toContain('<rect ');
    expect(svg.match(/<circle /g)).toHaveLength(LIGHT.contribRamp.length);
  });
});

describe('privacyNote', () => {
  it('names which population the card counted', () => {
    expect(privacyNote(true)).toBe('incl. private');
    expect(privacyNote(false)).toBe('public only');
  });
});

describe('rampLegend scale mode', () => {
  const scale = { thresholds: [1, 8, 20, 42] as const, unit: 'per day' };

  it('names the band each step covers and drops Less/More', () => {
    const svg = rampLegend(LIGHT, 0, 20, { scale });
    assertWellFormed(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    for (const caption of ['per day', '0', '1–7', '8–19', '20–41', '42+']) {
      expect(svg).toContain(`>${caption}<`);
    }
    expect(svg).not.toContain('>Less<');
    expect(svg).not.toContain('>More<');
  });

  it('renders an unreachable band as a dash rather than a backwards range', () => {
    const svg = rampLegend(LIGHT, 0, 20, { scale: { thresholds: [1, 1, 20, 42], unit: 'per day' } });
    expect(svg).toContain('>—<');
  });

  it('falls back to Less/More when the distribution is empty', () => {
    const svg = rampLegend(LIGHT, 0, 20, { scale: { thresholds: [0, 0, 0, 0], unit: 'per day' } });
    expect(svg).toContain('>Less<');
    expect(svg).toContain('>More<');
  });

  it('widens to fit its captions so callers can still right-align', () => {
    expect(rampLegendWidth({ scale })).toBeGreaterThan(rampLegendWidth());
  });
});
