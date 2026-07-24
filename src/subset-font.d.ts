/** Minimal ambient types for the `subset-font` dependency (ships no types). */
declare module 'subset-font' {
  interface SubsetFontOptions {
    /** Output format; defaults to "sfnt". */
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    /** Extra name-table IDs to retain (e.g. OFL license records). */
    preserveNameIds?: readonly number[] | null;
    /** Pin (number) or reduce (range) variable-font axes; pinned axes become static. */
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    /** Skip GSUB layout glyph closure. */
    noLayoutClosure?: boolean;
  }
  export default function subsetFont(font: Buffer, text: string, options?: SubsetFontOptions): Promise<Buffer>;
}
