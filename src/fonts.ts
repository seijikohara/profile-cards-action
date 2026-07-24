/**
 * Runtime font resolver.
 *
 * Supplies the two `@font-face` families the card renderer references —
 * `CardSans` (weights 200/400/600) and `CardMono` (weight 400) — as Base64
 * woff2 data URIs. The chosen sans and mono families are resolved
 * independently: the bundled default (Roboto / Roboto Mono) reads pre-subset
 * constants with no network, while any other family is fetched from Google
 * Fonts, instanced/nearest-matched to each card weight, and subset to the same
 * fixed charset as the defaults.
 *
 * Empirical Google Fonts CSS2 API findings (probed 2026-07-24, Chrome UA — a
 * modern UA is required or the API serves ttf instead of woff2):
 *
 *   Endpoint: https://fonts.googleapis.com/css2?family=<Name>:wght@<list>
 *
 *   - Family names are CASE-SENSITIVE ("Roboto" 200, "roboto" 400) and use
 *     "+" for spaces ("Roboto+Mono").
 *   - A multi-weight LIST query (e.g. :wght@100;200;...;900) returns the
 *     INTERSECTION of requested and available weights, silently dropping the
 *     rest — for BOTH variable and static fonts. A variable font emits one
 *     `@font-face` per in-range weight, all pointing at the SAME variable woff2
 *     (so distinct-url count is 1). A static font emits one `@font-face` per
 *     available weight, each a DIFFERENT woff2. Merriweather (var 300..900)
 *     returns 300..900; PT Sans (static) returns 400 and 700 with two URLs;
 *     Lobster (static single) returns just 400.
 *   - So the discrete weights returned by a full hundreds LIST reveal both the
 *     available weight set and, for variable fonts, the axis span (min/max of
 *     returned weights).
 *   - A RANGE query (:wght@LO..HI) only echoes LO/HI back and 400s when LO/HI
 *     fall outside the font's real axis, so it reveals nothing useful; the LIST
 *     form is used instead.
 *   - INVALID family -> HTTP 400 (text/html). A valid family always has at
 *     least one weight on the hundreds grid, so a 400 on the hundreds LIST is a
 *     reliable invalid-family signal.
 *   - The CSS groups all subset blocks per weight; the wanted latin face is the
 *     block preceded by the `/* latin *​/` comment (distinct from `latin-ext`).
 *
 * subset-font never runs in production for the default families (their
 * constants are pre-built by scripts/build-fonts.ts); it runs here only when a
 * non-default family is requested.
 */

import subsetFont from 'subset-font';
import { ROBOTO_200, ROBOTO_400, ROBOTO_600, ROBOTO_MONO_400 } from './fonts.generated.js';

// `subset-font` ships no types; they are declared ambiently in src/subset-font.d.ts.

// Fixed glyph set — MUST stay byte-identical to scripts/build-fonts.ts so
// fetched fonts carry the same glyphs as the bundled defaults. Printable ASCII
// (U+0020–U+007E) plus the Latin punctuation the cards emit. NOTE: the first
// SYMBOLS character is U+00A0 NO-BREAK SPACE (not a plain space) — do not
// "clean up" this literal. U+2192 (→) is intentionally excluded — it sits
// outside Google's "latin" subset, so arrows are drawn as SVG shapes, not
// glyphs.
const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)).join('');
const SYMBOLS = ' ·×–—‘’“”•…−€™';
const CHARSET = ASCII + SYMBOLS;

// Retain the OFL/Apache name-table records: copyright (0), trademark (7),
// license description (13), license URL (14).
const PRESERVE_NAME_IDS: readonly number[] = [0, 7, 13, 14];

// A modern desktop Chrome UA so the API serves woff2 rather than ttf.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Every weight on the standard grid; the API returns whichever the family
// actually provides (see file-level findings).
const HUNDREDS = '100;200;300;400;500;600;700;800;900';

// Fixed alias families and the card weights each must declare.
const CARD_SANS_WEIGHTS: readonly number[] = [200, 400, 600];
const CARD_MONO_WEIGHTS: readonly number[] = [400];

interface LatinFace {
  readonly weight: number;
  readonly url: string;
}

/**
 * Return the available weight nearest `target`. Ties resolve to the lighter
 * weight. Never throws for a non-empty set; a missing weight yields the closest
 * substitute rather than an error.
 */
export function nearestWeight(available: readonly number[], target: number): number {
  const sorted = available.toSorted((a, b) => a - b);
  const first = sorted[0];
  if (first === undefined) throw new Error('nearestWeight requires at least one available weight');
  return sorted.reduce((best, weight) => (Math.abs(weight - target) < Math.abs(best - target) ? weight : best), first);
}

/** Build one `@font-face` rule for an alias family at a fixed weight. */
function face(family: string, weight: number, base64: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${base64}) format('woff2')}`;
}

function invalidFontError(name: string): Error {
  return new Error(`Invalid font "${name}". Specify a valid Google Fonts family.`);
}

/** Encode a family name for the CSS2 `family=` parameter (spaces become "+"). */
function encodeFamily(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, '+');
}

/** Extract the latin `@font-face` faces (weight + woff2 URL) from a CSS2 response. */
function parseLatinFaces(css: string): LatinFace[] {
  const faces: LatinFace[] = [];
  // The `latin` comment must be followed immediately by its `@font-face`;
  // `latin-ext` is excluded because "latin" is not followed by `*/` there.
  const blocks = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  for (const block of css.matchAll(blocks)) {
    const body = block[1] ?? '';
    const weight = Number.parseInt(/font-weight:\s*([^;]+);/.exec(body)?.[1] ?? '', 10);
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1]?.trim();
    if (Number.isFinite(weight) && url) faces.push({ weight, url });
  }
  return faces;
}

/** Fetch the hundreds-list CSS for a family; throw a clear error for invalid names. */
async function fetchFamilyCss(name: string): Promise<string> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeFamily(name)}:wght@${HUNDREDS}`;
  const response = await fetch(url, { headers: { 'User-Agent': CHROME_UA } });
  if (response.status === 400) throw invalidFontError(name);
  if (!response.ok) throw new Error(`Failed to fetch font "${name}" from Google Fonts (HTTP ${response.status}).`);
  return response.text();
}

async function fetchWoff2(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'User-Agent': CHROME_UA } });
  if (!response.ok) throw new Error(`Failed to download font file (HTTP ${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Fetch a non-default family and emit one `@font-face` per card weight under
 * the fixed `alias`, each declaring its card weight even when a nearest-weight
 * substitution occurred.
 */
async function buildRemoteFaces(name: string, alias: string, cardWeights: readonly number[]): Promise<string[]> {
  const faces = parseLatinFaces(await fetchFamilyCss(name));
  if (faces.length === 0) throw invalidFontError(name);

  // First URL per weight, and how many weights share each URL. A URL shared by
  // more than one weight is the family's single variable file.
  const weightToUrl = new Map<number, string>();
  const weightsPerUrl = new Map<string, number>();
  for (const { weight, url } of faces) {
    if (!weightToUrl.has(weight)) weightToUrl.set(weight, url);
    weightsPerUrl.set(url, (weightsPerUrl.get(url) ?? 0) + 1);
  }
  const available = [...weightToUrl.keys()];

  // Download each distinct file at most once (variable fonts reuse one URL).
  const downloads = new Map<string, Promise<Buffer>>();
  const download = (url: string): Promise<Buffer> => {
    const inFlight = downloads.get(url);
    if (inFlight) return inFlight;
    const started = fetchWoff2(url);
    downloads.set(url, started);
    return started;
  };

  return Promise.all(
    cardWeights.map(async (target) => {
      const nearest = nearestWeight(available, target);
      const url = weightToUrl.get(nearest);
      if (url === undefined) throw invalidFontError(name); // unreachable: nearest comes from the map
      const isVariable = (weightsPerUrl.get(url) ?? 0) > 1;
      const source = await download(url);
      const subset = await subsetFont(source, CHARSET, {
        targetFormat: 'woff2',
        preserveNameIds: PRESERVE_NAME_IDS,
        // Pin a variable font to the (already clamped) nearest weight; leave a
        // static face untouched — it has no `wght` axis to instance.
        ...(isVariable ? { variationAxes: { wght: nearest } } : {}),
      });
      return face(alias, target, subset.toString('base64'));
    })
  );
}

function resolveSans(family: string): Promise<string[]> {
  if (family.trim().toLowerCase() === 'roboto') {
    return Promise.resolve([
      face('CardSans', 200, ROBOTO_200),
      face('CardSans', 400, ROBOTO_400),
      face('CardSans', 600, ROBOTO_600),
    ]);
  }
  return buildRemoteFaces(family.trim(), 'CardSans', CARD_SANS_WEIGHTS);
}

function resolveMono(family: string): Promise<string[]> {
  if (family.trim().toLowerCase() === 'roboto mono') {
    return Promise.resolve([face('CardMono', 400, ROBOTO_MONO_400)]);
  }
  return buildRemoteFaces(family.trim(), 'CardMono', CARD_MONO_WEIGHTS);
}

/**
 * Resolve the sans and mono families into a CSS `@font-face` block declaring
 * `CardSans` (200/400/600) and `CardMono` (400) as Base64 woff2 data URIs.
 */
export async function resolveFonts(sansFamily: string, monoFamily: string): Promise<string> {
  const [sans, mono] = await Promise.all([resolveSans(sansFamily), resolveMono(monoFamily)]);
  return [...sans, ...mono].join('\n');
}
