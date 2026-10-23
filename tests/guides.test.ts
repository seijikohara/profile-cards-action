/** Guide lines and the round steps they are placed at. */

import { describe, expect, it } from 'vitest';
import { hGuide, niceStep, vGuide } from '../src/svg/guides.js';
import { LIGHT } from '../src/theme.js';

describe('niceStep', () => {
  it('picks 1, 2, 2.5, or 5 times a power of ten', () => {
    expect(niceStep(4838, 3)).toBe(2000);
    expect(niceStep(900, 3)).toBe(500);
    expect(niceStep(7, 3)).toBe(2.5);
    expect(niceStep(30_000, 3)).toBe(10_000);
  });

  it('returns 0 for an empty range', () => {
    expect(niceStep(0, 3)).toBe(0);
    expect(niceStep(100, 0)).toBe(0);
  });
});

describe('guides', () => {
  it('snaps to the pixel grid and dashes in the muted border color', () => {
    expect(hGuide(10, 90, 40.3, LIGHT)).toBe(
      `<line x1="10" y1="40.5" x2="90" y2="40.5" stroke="${LIGHT.borderMuted}" stroke-width="1" stroke-dasharray="2 4"/>`
    );
    expect(vGuide(55.8, 0, 100, LIGHT)).toContain('x1="56.5"');
  });
});
