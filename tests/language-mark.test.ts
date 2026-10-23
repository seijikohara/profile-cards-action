/** Language marks: curated logos, a dot for everything else. */

import { describe, expect, it } from 'vitest';
import { LANGUAGE_SLUGS, languageMark } from '../src/cards/language-mark.js';
import { brandBySlug, findBrand } from '../src/svg/brands.js';
import { assertWellFormed } from './xml.js';

describe('languageMark', () => {
  it('maps every curated language to a glyph simple-icons still ships', () => {
    // A slug renamed or dropped upstream would silently turn a logo back into
    // a dot; this fails on the dependency bump instead.
    for (const [language, slug] of Object.entries(LANGUAGE_SLUGS)) {
      expect(brandBySlug(slug), `${language} -> ${slug}`).toBeDefined();
    }
  });

  it('draws a curated language as its logo in the language color', () => {
    const svg = languageMark('TypeScript', '#3178c6', 30, 40, 13);
    assertWellFormed(svg);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain(`d="${brandBySlug('typescript')?.path ?? ''}"`);
    expect(svg).toContain('fill="#3178c6"');
    expect(svg).toContain('x="23.5" y="33.5" width="13" height="13"');
  });

  it('keeps a dot for languages without a curated logo', () => {
    expect(languageMark('Other', '#888888', 30, 40, 13)).toMatch(
      /^<circle cx="30" cy="40" r="4.55" fill="#888888"\/>$/
    );
    expect(languageMark(undefined, '#888888', 30, 40, 13)).toMatch(/^<circle /);
  });

  it('never resolves a language through free-form brand lookup', () => {
    // The trap the curated table exists for: a name-based lookup would hand
    // Shell an oil company's logo and C++ the C logo.
    expect(findBrand('Shell')?.slug).toBe('shell');
    expect(LANGUAGE_SLUGS['Shell']).toBe('gnubash');
    expect(LANGUAGE_SLUGS['C++']).toBe('cplusplus');
  });
});
