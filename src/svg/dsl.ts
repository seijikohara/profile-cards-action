/**
 * Minimal SVG string builder.
 *
 * The single place that emits markup: every dynamic value passes through esc()
 * or num(), so cards cannot produce malformed or injectable SVG.
 */

export type AttrValue = string | number | undefined;

/** Escape text nodes and attribute values. */
export function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Render a number with at most 2 decimals, no trailing zeros — keeps output compact and deterministic. */
export function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`non-finite SVG coordinate: ${v}`);
  return String(Math.round(v * 100) / 100);
}

function renderAttrs(attrs: Record<string, AttrValue>): string {
  let out = '';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    const rendered = typeof value === 'number' ? num(value) : esc(value);
    out += ` ${key}="${rendered}"`;
  }
  return out;
}

/** Build an element. Children are pre-rendered strings (from el/text helpers only). */
export function el(name: string, attrs: Record<string, AttrValue> = {}, ...children: string[]): string {
  const body = children.join('');
  return body === '' ? `<${name}${renderAttrs(attrs)}/>` : `<${name}${renderAttrs(attrs)}>${body}</${name}>`;
}

/** Escaped text node. */
export function textNode(value: string): string {
  return esc(value);
}
