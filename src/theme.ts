/**
 * Design tokens for both GitHub themes.
 *
 * Color values are GitHub Primer functional tokens (@primer/primitives 11.9.0)
 * so cards blend into the page chrome, plus the contribution-graph green ramps.
 * Verified against the published CSS on 2026-07-22; several values differ from
 * older widely-copied palettes (border, accent, muted backgrounds).
 */

export interface Theme {
  readonly id: 'light' | 'dark';
  /** Card background — matches the page canvas. */
  readonly bg: string;
  /** Inset panels (tiles, tracks). */
  readonly bgInset: string;
  readonly border: string;
  readonly fg: string;
  readonly fgMuted: string;
  readonly accent: string;
  /** Contribution levels NONE..FOURTH_QUARTILE (GitHub's own ramp). */
  readonly contribRamp: readonly [string, string, string, string, string];
  /**
   * Categorical series colors for the composition card, in segment order:
   * commits, pull requests, issues, reviews, private. Primer data hues, chosen
   * to stay legible on the inset background; private is a quiet neutral.
   */
  readonly seriesRamp: readonly [string, string, string, string, string];
}

export const LIGHT: Theme = {
  id: 'light',
  bg: '#ffffff',
  bgInset: '#f6f8fa',
  border: '#d1d9e0',
  fg: '#1f2328',
  fgMuted: '#59636e',
  accent: '#0969da',
  contribRamp: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  seriesRamp: ['#0969da', '#8250df', '#1a7f37', '#bc4c00', '#8b949e'],
};

export const DARK: Theme = {
  id: 'dark',
  bg: '#0d1117',
  bgInset: '#151b23',
  border: '#3d444d',
  fg: '#f0f6fc',
  fgMuted: '#9198a1',
  accent: '#4493f8',
  contribRamp: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  seriesRamp: ['#4493f8', '#a371f7', '#3fb950', '#db6d28', '#6e7681'],
};

export const THEMES: readonly Theme[] = [LIGHT, DARK];

// System stacks (no embedded webfont) — used as-is by the lightweight badges.
// The cards prepend 'Roboto' / 'Roboto Mono' in cardFrame, where the matching
// @font-face is embedded.
export const FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
export const FONT_MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

/** Parse #rrggbb into channels. Throws on malformed input (all inputs are first-party constants or linguist colors). */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || m[1] === undefined) throw new Error(`invalid hex color: ${hex}`);
  const v = Number.parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function channelHex(n: number): string {
  return Math.min(255, Math.max(0, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

function toHex(r: number, g: number, b: number): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

/** Mix a color toward black (amount 0..1). Used for isometric side-face shading. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = 1 - amount;
  return toHex(r * k, g * k, b * k);
}

/** Convert one 0..255 sRGB channel to linear light (WCAG). */
function srgbToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, for picking readable icon fills per theme. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
