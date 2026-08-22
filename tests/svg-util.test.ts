import { describe, expect, it } from 'vitest';
import { el, esc, num } from '../src/svg/dsl.js';
import {
  formatBytes,
  formatCompact,
  formatDate,
  formatDateRange,
  formatInt,
  formatUtcTimestamp,
  measureSans,
} from '../src/svg/text.js';
import { contrast, hexToRgb, shade } from '../src/theme.js';

describe('formatCompact', () => {
  it('passes small values through and steps to k then m', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(1000)).toBe('1k');
    expect(formatCompact(2450)).toBe('2.5k');
    expect(formatCompact(45231)).toBe('45k');
    expect(formatCompact(999_499)).toBe('999k');
    expect(formatCompact(1_871_000)).toBe('1.9m');
    expect(formatCompact(12_400_000)).toBe('12m');
  });
});

describe('formatBytes', () => {
  it('formats decimal byte magnitudes with a unit space', () => {
    expect(formatBytes(912)).toBe('912 B');
    expect(formatBytes(1000)).toBe('1.0 KB');
    expect(formatBytes(66_688)).toBe('67 KB');
    expect(formatBytes(708_082)).toBe('708 KB');
    expect(formatBytes(7_036_949)).toBe('7.0 MB');
    expect(formatBytes(14_249_614)).toBe('14 MB');
  });
});

describe('esc', () => {
  it('escapes markup-significant characters', () => {
    expect(esc(`<img src="x" onload='a&b'>`)).toBe('&lt;img src=&quot;x&quot; onload=&#39;a&amp;b&#39;&gt;');
  });
});

describe('num', () => {
  it('rounds to two decimals without trailing noise', () => {
    expect(num(1.006)).toBe('1.01');
    expect(num(3)).toBe('3');
    expect(num(-0.3333)).toBe('-0.33');
  });
  it('rejects non-finite values', () => {
    expect(() => num(Number.NaN)).toThrow(/non-finite/);
    expect(() => num(Infinity)).toThrow(/non-finite/);
  });
});

describe('el', () => {
  it('self-closes empty elements and escapes attributes', () => {
    expect(el('rect', { x: 1, fill: '#fff', title: `a"b` })).toBe('<rect x="1" fill="#fff" title="a&quot;b"/>');
  });
  it('skips undefined attributes', () => {
    expect(el('g', { class: undefined })).toBe('<g/>');
  });
});

describe('formatting', () => {
  it('groups thousands', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(11145)).toBe('11,145');
    expect(formatInt(-1234567)).toBe('-1,234,567');
  });
  it('formats UTC timestamps to minute precision', () => {
    expect(formatUtcTimestamp('2026-07-22T03:17:45.123Z')).toBe('2026-07-22 03:17 UTC');
    expect(() => formatUtcTimestamp('not a date')).toThrow(/invalid ISO/);
  });
  it('formats dates and ranges, collapsing shared years', () => {
    expect(formatDate('2026-07-22', true)).toBe('Jul 22, 2026');
    expect(formatDate('2026-01-05', false)).toBe('Jan 5');
    expect(formatDateRange('2026-05-31', '2026-07-22')).toBe('May 31 – Jul 22, 2026');
    expect(formatDateRange('2025-12-30', '2026-02-19')).toBe('Dec 30, 2025 – Feb 19, 2026');
    expect(formatDateRange('2026-07-22', '2026-07-22')).toBe('Jul 22, 2026');
    expect(() => formatDate('2026-13-99', true)).toThrow(/invalid calendar date/);
  });
});

describe('measurement', () => {
  it('scales linearly with size and grows with weight', () => {
    const base = measureSans('Contributions', 12);
    expect(measureSans('Contributions', 24)).toBeCloseTo(base * 2, 5);
    expect(measureSans('Contributions', 12, 'semibold')).toBeGreaterThan(base);
  });
});

describe('color utilities', () => {
  it('parses and shades hex colors', () => {
    expect(hexToRgb('#40c463')).toEqual([0x40, 0xc4, 0x63]);
    expect(shade('#ffffff', 0.5)).toBe('#808080');
    expect(() => hexToRgb('nope')).toThrow(/invalid hex/);
  });
  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#181717', '#151b23')).toBeLessThan(1.6);
  });
});
