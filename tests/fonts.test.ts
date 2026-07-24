import { afterEach, describe, expect, it, vi } from 'vitest';
import { nearestWeight, resolveFonts } from '../src/fonts.js';
import { ROBOTO_200, ROBOTO_400, ROBOTO_600, ROBOTO_MONO_400 } from '../src/fonts.generated.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const FACE = /@font-face/g;

// --- remote-path mock helpers -----------------------------------------------

/** Build a Google Fonts CSS2 latin `@font-face` block mapping a weight to a woff2 URL. */
function latinBlock(family: string, weight: number, url: string): string {
  return `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  src: url(${url}) format('woff2');
  unicode-range: U+0000-00FF;
}`;
}

/** Build a latin-ext block; the resolver must ignore it and read only latin. */
function latinExtBlock(family: string, weight: number, url: string): string {
  return `/* latin-ext */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  src: url(${url}) format('woff2');
  unicode-range: U+0100-02BA;
}`;
}

/** Stub global fetch: CSS2 requests return `css`; font-file URLs return `files[url]`. */
function stubFetch(css: string, files: Record<string, Buffer>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('fonts.googleapis.com/css2')) {
      return new Response(css, { status: 200, headers: { 'content-type': 'text/css' } });
    }
    const bytes = files[url];
    if (bytes) {
      return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'font/woff2' } });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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

describe('resolveFonts remote variable family', () => {
  it('embeds one weight-range face from a single shared woff2', async () => {
    const varUrl = 'https://fonts.gstatic.com/s/varsans/latin.woff2';
    const extUrl = 'https://fonts.gstatic.com/s/varsans/latin-ext.woff2';
    const woff2 = Buffer.from('wOF2-variable-font-bytes');
    // Weights 300..900 all point at ONE latin woff2 -> variable family. The
    // latin-ext blocks share a different URL and must be ignored.
    const css = [300, 400, 500, 600, 700, 800, 900]
      .flatMap((w) => [latinExtBlock('VarSans', w, extUrl), latinBlock('VarSans', w, varUrl)])
      .join('\n');
    const fetchMock = stubFetch(css, { [varUrl]: woff2 });

    // Mono stays the bundled default, so only the sans family is fetched.
    const css_out = await resolveFonts('VarSans', 'Roboto Mono');
    const b64 = woff2.toString('base64');

    // Exactly one CardSans face, declared as a weight range spanning the axis.
    expect(css_out.match(/font-family:'CardSans'/g)).toHaveLength(1);
    expect(css_out).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:300 900;src:url(data:font/woff2;base64,${b64}) format('woff2')}`
    );
    // Plus the untouched bundled mono face; two faces total.
    expect(css_out).toContain(`base64,${ROBOTO_MONO_400}`);
    expect(css_out.match(FACE)).toHaveLength(2);

    // The variable payload is downloaded once, not per weight: 1 CSS + 1 woff2.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('resolveFonts remote static family', () => {
  it('embeds one face per card weight using the nearest available weight file', async () => {
    const url400 = 'https://fonts.gstatic.com/s/statsans/w400.woff2';
    const url700 = 'https://fonts.gstatic.com/s/statsans/w700.woff2';
    const woff2_400 = Buffer.from('wOF2-static-400');
    const woff2_700 = Buffer.from('wOF2-static-700');
    // Distinct per-weight URLs -> static family. Only 400 and 700 available.
    const css = [latinBlock('StatSans', 400, url400), latinBlock('StatSans', 700, url700)].join('\n');
    const fetchMock = stubFetch(css, { [url400]: woff2_400, [url700]: woff2_700 });

    const css_out = await resolveFonts('StatSans', 'Roboto Mono');
    const b64_400 = woff2_400.toString('base64');
    const b64_700 = woff2_700.toString('base64');

    // Three CardSans faces, declared at the card weights 200/400/600.
    expect(css_out.match(/font-family:'CardSans'/g)).toHaveLength(3);
    // 200 and 400 map to nearest 400; 600 maps to nearest 700.
    expect(css_out).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:200;src:url(data:font/woff2;base64,${b64_400}) format('woff2')}`
    );
    expect(css_out).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64_400}) format('woff2')}`
    );
    expect(css_out).toContain(
      `@font-face{font-family:'CardSans';font-style:normal;font-weight:600;src:url(data:font/woff2;base64,${b64_700}) format('woff2')}`
    );
    // Three sans faces + the bundled mono face.
    expect(css_out.match(FACE)).toHaveLength(4);

    // Downloads are cached: 400 is reused for the 200 and 400 faces.
    // 1 CSS + 2 distinct woff2 = 3 calls.
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
// FONTS_LIVE=1 to exercise the fetch/embed path end to end. Uses Merriweather
// (variable, axis 300..900 -> one CardSans weight-range face) and PT Sans
// (static, weights 400/700 -> one CardMono face at 400).
const LIVE = process.env['FONTS_LIVE'] === '1';
describe('resolveFonts live network (opt-in)', () => {
  it.skipIf(!LIVE)(
    'fetches and embeds non-default families without subsetting',
    async () => {
      const css = await resolveFonts('Merriweather', 'PT Sans');
      expect(css.match(FACE)).toHaveLength(2);
      expect(css.match(/font-family:'CardSans'/g)).toHaveLength(1);
      expect(css.match(/font-family:'CardMono'/g)).toHaveLength(1);
      expect(css.match(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\) format\('woff2'\)/g)).toHaveLength(2);
      // The variable sans face declares a weight range; the static mono face a single weight.
      expect(css).toMatch(/font-family:'CardSans';font-style:normal;font-weight:\d+ \d+;/);
      expect(css).toContain("font-family:'CardMono';font-style:normal;font-weight:400;");
    },
    30_000
  );
});
