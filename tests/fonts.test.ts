import { afterEach, describe, expect, it, vi } from 'vitest';
import { nearestWeight, resolveFonts } from '../src/fonts.js';
import { ROBOTO_200, ROBOTO_400, ROBOTO_600, ROBOTO_MONO_400 } from '../src/fonts.generated.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const FACE = /@font-face/g;

describe('resolveFonts default path', () => {
  it('emits the four bundled faces without touching the network', async () => {
    // Any network call in the default path is a bug: fail loudly if one happens.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('default path must not hit the network');
      })
    );

    const css = await resolveFonts('Roboto', 'Roboto Mono');

    expect(css.match(FACE)).toHaveLength(4);
    // Three CardSans faces (200/400/600) + one CardMono face (400).
    expect(css.match(/font-family:'CardSans'/g)).toHaveLength(3);
    expect(css.match(/font-family:'CardMono'/g)).toHaveLength(1);
    expect(css.match(/src:url\(data:font\/woff2;base64,/g)).toHaveLength(4);

    // Each face declares its card weight and embeds the matching bundled woff2.
    expect(css).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:200;src:url(data:font/woff2;base64,${ROBOTO_200}) format('woff2')}`
    );
    expect(css).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${ROBOTO_400}) format('woff2')}`
    );
    expect(css).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:600;src:url(data:font/woff2;base64,${ROBOTO_600}) format('woff2')}`
    );
    expect(css).toContain(
      `@font-face{font-family:'CardMono';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${ROBOTO_MONO_400}) format('woff2')}`
    );
  });

  it('treats family names case- and whitespace-insensitively for the default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('default path must not hit the network');
      })
    );

    const css = await resolveFonts('  RoBoTo  ', 'roboto mono');
    expect(css.match(FACE)).toHaveLength(4);
    expect(css).toContain(`base64,${ROBOTO_200}`);
    expect(css).toContain(`base64,${ROBOTO_MONO_400}`);
  });
});

describe('nearestWeight', () => {
  it('maps to the exact weight when present', () => {
    expect(nearestWeight([300, 400, 700], 400)).toBe(400);
  });

  it('substitutes the nearest available weight', () => {
    expect(nearestWeight([300, 400, 700], 200)).toBe(300);
    expect(nearestWeight([300, 400, 700], 600)).toBe(700);
  });

  it('clamps to the available range', () => {
    expect(nearestWeight([300, 400, 500], 100)).toBe(300);
    expect(nearestWeight([300, 400, 500], 900)).toBe(500);
  });

  it('breaks ties toward the lighter weight and ignores input order', () => {
    expect(nearestWeight([300, 500], 400)).toBe(300);
    expect(nearestWeight([700, 300, 400], 600)).toBe(700);
  });

  it('throws for an empty set', () => {
    expect(() => nearestWeight([], 400)).toThrow(/at least one available weight/);
  });
});

describe('resolveFonts invalid family', () => {
  it('rejects with a clear message when the API reports an unknown family', async () => {
    // The observed invalid-family response: HTTP 400 with an HTML body.
    const fetchMock = vi.fn(
      async () =>
        new Response('<!DOCTYPE html><html><body>400. That’s an error.</body></html>', {
          status: 400,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    // The mono family is the default, so only the sans family is fetched.
    await expect(resolveFonts('Notafont123', 'Roboto Mono')).rejects.toThrow(
      'Invalid font "Notafont123". Specify a valid Google Fonts family.'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestedUrl, init] = fetchMock.mock.calls[0] ?? [undefined, undefined];
    expect(String(requestedUrl)).toContain('family=Notafont123:wght@100;200;300;400;500;600;700;800;900');
    // A modern Chrome UA is required or the API serves ttf instead of woff2.
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('Chrome'),
    });
  });
});

// Opt-in live-network check (real Google Fonts). Skipped by default; run with
// FONTS_LIVE=1 to exercise the fetch/subset path end to end. Uses Merriweather
// (variable, axis 300..900 — weight 200 clamps to 300) and PT Sans (static,
// weights 400/700).
const LIVE = process.env['FONTS_LIVE'] === '1';
describe('resolveFonts live network (opt-in)', () => {
  it.skipIf(!LIVE)(
    'fetches, instances, and subsets non-default families',
    async () => {
      const css = await resolveFonts('Merriweather', 'PT Sans');
      expect(css.match(FACE)).toHaveLength(4);
      expect(css.match(/font-family:'CardSans'/g)).toHaveLength(3);
      expect(css.match(/font-family:'CardMono'/g)).toHaveLength(1);
      expect(css.match(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\) format\('woff2'\)/g)).toHaveLength(4);
      // Card weights are declared verbatim regardless of substitution.
      expect(css).toContain("font-family:'CardSans';font-style:normal;font-weight:200;");
      expect(css).toContain("font-family:'CardMono';font-style:normal;font-weight:400;");
    },
    30_000
  );
});
