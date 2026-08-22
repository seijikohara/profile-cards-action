/**
 * Text measurement and number formatting for SVG layout.
 *
 * SVG-in-<img> renders with the viewer's system font, so exact metrics are
 * unknowable. Layout uses Helvetica AFM advance widths (the narrowest common
 * member of the stack is close to these) plus a small safety factor applied by
 * callers that truncate.
 */

/** Helvetica advance widths for ASCII 32..126, in 1/1000 em. */
const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

const DEFAULT_EM = 0.6; // fallback for characters outside ASCII
const BOLD_FACTOR = 1.08; // Helvetica Bold runs ~8% wider

export type FontWeight = 'regular' | 'semibold';

/** Estimated rendered width of `text` at `size` px in the sans stack. */
export function measureSans(text: string, size: number, weight: FontWeight = 'regular'): number {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const w = code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : undefined;
    em += (w ?? DEFAULT_EM * 1000) / 1000;
  }
  return em * size * (weight === 'semibold' ? BOLD_FACTOR : 1);
}

/** 12345 -> "12,345". Hand-rolled so output never depends on ICU data. */
export function formatInt(v: number): string {
  const sign = v < 0 ? '-' : '';
  const digits = String(Math.trunc(Math.abs(v)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Compact magnitude: 999 -> "999", 45231 -> "45.2k", 1871000 -> "1.9m". */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value >= 1_000_000 ? value / 1_000_000 : value / 1000;
  const unit = value >= 1_000_000 ? 'm' : 'k';
  return `${scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10}${unit}`;
}

/**
 * Bytes in decimal units: 912 -> "912 B", 708082 -> "708 KB", 7036949 -> "7.0 MB".
 * One decimal below 10 so small magnitudes keep a significant digit.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const scaled = bytes >= 1_000_000 ? bytes / 1_000_000 : bytes / 1000;
  const unit = bytes >= 1_000_000 ? 'MB' : 'KB';
  return `${scaled >= 10 ? String(Math.round(scaled)) : (Math.round(scaled * 10) / 10).toFixed(1)} ${unit}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-07-22" -> "Jul 22" or "Jul 22, 2026". */
export function formatDate(date: string, withYear: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || month === undefined) throw new Error(`invalid calendar date: ${date}`);
  const day = Number(m[3]);
  return withYear ? `${month} ${day}, ${m[1]}` : `${month} ${day}`;
}

/** Inclusive range, collapsing a shared year: "May 31 – Jul 22, 2026". */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(end, true);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, !sameYear)} – ${formatDate(end, true)}`;
}

/** "2026-07-22T03:17:45.123Z" -> "2026-07-22 03:17 UTC". */
export function formatUtcTimestamp(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!m) throw new Error(`invalid ISO timestamp: ${iso}`);
  return `${m[1]} ${m[2]} UTC`;
}
