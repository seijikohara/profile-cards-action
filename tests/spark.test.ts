import { describe, expect, it } from 'vitest';
import { cardSvg } from '../src/cards/frame.js';
import { renderOverview } from '../src/cards/overview.js';
import type { ProfileData } from '../src/model.js';
import { deltaTriangle, sparkline } from '../src/svg/spark.js';
import { LIGHT } from '../src/theme.js';
import { makeFixture } from './fixture.js';
import { assertWellFormed } from './xml.js';

describe('sparkline', () => {
  it('draws nothing for a series with no shape', () => {
    expect(sparkline([], 0, 40, 100, 20, LIGHT)).toBe('');
    expect(sparkline([5], 0, 40, 100, 20, LIGHT)).toBe('');
    expect(sparkline([0, 0, 0], 0, 40, 100, 20, LIGHT)).toBe('');
  });

  it('anchors at zero so a small wobble stays small', () => {
    const svg = sparkline([100, 101, 102], 0, 40, 100, 20, LIGHT);
    // 100/102 of the height, not the full height a min-anchored scale would give.
    expect(svg).toContain('20.39');
    expect(svg).not.toContain('M0 40L0 40');
  });

  it('marks the latest value and stays well-formed', () => {
    const svg = sparkline([1, 2, 3], 0, 40, 100, 20, LIGHT);
    assertWellFormed(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    expect(svg).toContain('<circle cx="100" cy="20"');
  });

  it('fills from the frame gradient, whose stop-opacity the reduced-motion reset cannot override', () => {
    const svg = sparkline([1, 2, 3], 0, 40, 100, 20, LIGHT);
    expect(svg).toContain('fill="url(#area)"');
    expect(svg).not.toContain(' opacity=');
  });
});

describe('deltaTriangle', () => {
  it('draws the direction as a path, since the embedded font is subset', () => {
    const up = deltaTriangle(10, 10, true, '#000');
    const down = deltaTriangle(10, 10, false, '#000');
    expect(up).toMatch(/^<path d="M/);
    expect(up).not.toBe(down);
  });
});

describe('renderOverview trends', () => {
  const data: ProfileData = makeFixture();

  it('compares year to date against the same window a year back', () => {
    const svg = cardSvg(renderOverview(data, LIGHT), '');
    expect(svg).toMatch(/\d+% YTD/);
  });

  it('withholds the whole trend band when there are too few years', () => {
    const short: ProfileData = { ...data, years: data.years.slice(-3) };
    const svg = cardSvg(renderOverview(short, LIGHT), '');
    expect(svg).not.toContain('YTD');
  });

  it('keeps each row even and gives the sparkline band only to the row that uses it', () => {
    const svg = cardSvg(renderOverview(data, LIGHT), '');
    // The tiles are the only rects painted on the inset background.
    const heights = [...svg.matchAll(new RegExp(`<rect [^>]*height="([\\d.]+)"[^>]*fill="${LIGHT.bgInset}"`, 'g'))].map(
      (match) => Number(match[1])
    );
    expect(heights).toHaveLength(8);
    const [first, second] = [heights.slice(0, 4), heights.slice(4)];
    expect(new Set(first).size).toBe(1);
    expect(new Set(second).size).toBe(1);
    // Every counter with a yearly series sits in the first row.
    expect(first[0]).toBeGreaterThan(second[0] ?? 0);
  });
});
