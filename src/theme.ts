/**
 * Design tokens for both GitHub themes.
 *
 * Color values are GitHub Primer functional tokens (@primer/primitives 11.9.0)
 * so cards blend into the page chrome, plus the contribution-graph green ramps.
 * Verified against the published CSS on 2026-07-22; several values differ from
 * older widely-copied palettes (border, accent, muted backgrounds).
 *
 * A theme is one color mode in one palette: the surfaces come from the mode,
 * the magnitude ramp and the chrome accent from the palette.
 */

/** Hue family for every magnitude mark and the card chrome's accent. */
export type PaletteId = 'green' | 'blue' | 'purple' | 'orange';

/** Palettes the `palette` input accepts; `green` is GitHub's own and the default. */
export const PALETTE_IDS: readonly PaletteId[] = ['green', 'blue', 'purple', 'orange'];

export interface Theme {
  readonly id: 'light' | 'dark';
  readonly palette: PaletteId;
  /** Card background — matches the page canvas. */
  readonly bg: string;
  /** Inset panels (tiles, tracks). */
  readonly bgInset: string;
  readonly border: string;
  /** Hairline around inset panels; quieter than the card border so tiles read as one surface. */
  readonly borderMuted: string;
  readonly fg: string;
  readonly fgMuted: string;
  readonly accent: string;
  /**
   * The palette's text-safe hue (>= 4.5:1 on `bg`), for the card eyebrow,
   * icons, and the corner glow.
   */
  readonly ink: string;
  /** Neighbouring hue at the same lightness; `ink` -> `inkAlt` is the headline-number gradient. */
  readonly inkAlt: string;
  /**
   * Contribution levels NONE..FOURTH_QUARTILE. `green` is GitHub's own ramp;
   * the others keep each level's OKLCH lightness and chroma and swap the hue,
   * so every contrast rule tuned against green holds for them too.
   */
  readonly contribRamp: readonly [string, string, string, string, string];
  /**
   * Categorical series colors for the composition card, in segment order:
   * commits, issues, pull requests, reviews, private. Primer data hues, chosen
   * to stay legible on the inset background; private is a quiet neutral. Issues
   * sits between commits and pull requests so the blue/purple pair never stacks
   * adjacently — measured protan dE 1.9 when adjacent, 16.3 with green between.
   */
  readonly seriesRamp: readonly [string, string, string, string, string];
}

type Ramp = Theme['contribRamp'];

/** The palette-dependent part of a theme. */
interface PaletteTokens {
  readonly ink: string;
  readonly inkAlt: string;
  readonly contribRamp: Ramp;
}

// Inks are Primer fg tokens (success/accent/done/severe). Each inkAlt is its ink
// rotated ~40 degrees in OKLCH at the same lightness, which keeps the gradient
// from reading as a second, unexplained color.
const PALETTES: Readonly<Record<PaletteId, Readonly<Record<Theme['id'], PaletteTokens>>>> = {
  green: {
    light: {
      ink: '#1a7f37',
      inkAlt: '#097a78',
      contribRamp: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    },
    dark: {
      ink: '#3fb950',
      inkAlt: '#08b4ae',
      contribRamp: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    },
  },
  blue: {
    light: {
      ink: '#0969da',
      inkAlt: '#764fd1',
      contribRamp: ['#ebedf0', '#b7d6ff', '#66a9fe', '#3d89e4', '#2f5d9b'],
    },
    dark: {
      ink: '#4493f8',
      inkAlt: '#957cf1',
      contribRamp: ['#161b22', '#22385f', '#205a9f', '#0f8ef1', '#70b7ff'],
    },
  },
  purple: {
    light: {
      ink: '#8250df',
      inkAlt: '#b933a4',
      contribRamp: ['#ebedf0', '#dbc8fe', '#b78bfe', '#976fd8', '#694c91'],
    },
    dark: {
      ink: '#ab7df8',
      inkAlt: '#df68bf',
      contribRamp: ['#161b22', '#422e57', '#664695', '#966fe9', '#b89fff'],
    },
  },
  orange: {
    light: {
      ink: '#bc4c00',
      inkAlt: '#bf4155',
      contribRamp: ['#ebedf0', '#fec5a5', '#fc7f26', '#d06619', '#8d4715'],
    },
    dark: {
      ink: '#db6d28',
      inkAlt: '#e0626a',
      contribRamp: ['#161b22', '#552d0d', '#8e4103', '#de5f0a', '#ff905c'],
    },
  },
};

/** The palette-independent part of each mode. */
const SURFACES: Readonly<Record<Theme['id'], Omit<Theme, 'id' | 'palette' | keyof PaletteTokens>>> = {
  light: {
    bg: '#ffffff',
    bgInset: '#f6f8fa',
    border: '#d1d9e0',
    borderMuted: '#e4e8ec',
    fg: '#1f2328',
    fgMuted: '#59636e',
    accent: '#0969da',
    seriesRamp: ['#0969da', '#1a7f37', '#8250df', '#bc4c00', '#8b949e'],
  },
  dark: {
    bg: '#0d1117',
    bgInset: '#151b23',
    border: '#3d444d',
    borderMuted: '#262c34',
    fg: '#f0f6fc',
    fgMuted: '#9198a1',
    accent: '#4493f8',
    seriesRamp: ['#4493f8', '#3fb950', '#a371f7', '#db6d28', '#6e7681'],
  },
};

/** Build the theme for one color mode in one palette. */
export function themeFor(id: Theme['id'], palette: PaletteId): Theme {
  return { id, palette, ...SURFACES[id], ...PALETTES[palette][id] };
}

export const LIGHT: Theme = themeFor('light', 'green');
export const DARK: Theme = themeFor('dark', 'green');

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
