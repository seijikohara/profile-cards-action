/** A language's mark beside a name: its logo where one exists, else a dot. */

import { brandBySlug } from '../svg/brands.js';
import { el } from '../svg/dsl.js';

/**
 * Linguist language name -> simple-icons slug, curated by hand.
 *
 * Matching by name is unsafe: simple-icons is a set of brands, not languages,
 * so "Shell" finds an oil company and "C++" normalizes to plain C. A language
 * missing here keeps its dot rather than risk a wrong mark.
 */
export const LANGUAGE_SLUGS: Readonly<Record<string, string>> = {
  Astro: 'astro',
  C: 'c',
  'C++': 'cplusplus',
  CMake: 'cmake',
  CSS: 'css',
  Clojure: 'clojure',
  CoffeeScript: 'coffeescript',
  'Common Lisp': 'commonlisp',
  Crystal: 'crystal',
  D: 'd',
  Dart: 'dart',
  Dockerfile: 'docker',
  EJS: 'ejs',
  Elixir: 'elixir',
  Elm: 'elm',
  'Emacs Lisp': 'gnuemacs',
  Erlang: 'erlang',
  'F#': 'fsharp',
  Fortran: 'fortran',
  GDScript: 'godotengine',
  Gherkin: 'cucumber',
  Gleam: 'gleam',
  Go: 'go',
  GraphQL: 'graphql',
  Groovy: 'apachegroovy',
  HTML: 'html5',
  Haskell: 'haskell',
  Haxe: 'haxe',
  Java: 'openjdk',
  JavaScript: 'javascript',
  Jinja: 'jinja',
  'Jupyter Notebook': 'jupyter',
  Julia: 'julia',
  Kotlin: 'kotlin',
  Less: 'less',
  Lua: 'lua',
  MDX: 'mdx',
  Markdown: 'markdown',
  Mermaid: 'mermaid',
  Nim: 'nim',
  Nix: 'nixos',
  Nunjucks: 'nunjucks',
  Nushell: 'nushell',
  OCaml: 'ocaml',
  PHP: 'php',
  Perl: 'perl',
  Prisma: 'prisma',
  Pug: 'pug',
  PureScript: 'purescript',
  Python: 'python',
  R: 'r',
  Racket: 'racket',
  ReScript: 'rescript',
  Reason: 'reason',
  Ruby: 'ruby',
  Rust: 'rust',
  SCSS: 'sass',
  Sass: 'sass',
  Scala: 'scala',
  Shell: 'gnubash',
  Solidity: 'solidity',
  Stylus: 'stylus',
  Svelte: 'svelte',
  Swift: 'swift',
  TeX: 'latex',
  Typst: 'typst',
  TypeScript: 'typescript',
  V: 'v',
  'Vim Script': 'vim',
  Vue: 'vuedotjs',
  WebAssembly: 'webassembly',
  YAML: 'yaml',
  Zig: 'zig',
};

/**
 * Draw the mark for `name` centered on (cx, cy) in a `size`-pixel box, filled
 * with the language's own color so it still keys the treemap and the rows.
 * A nested <svg> scales the 24-unit glyph; see icons.ts for why not a transform.
 */
export function languageMark(name: string | undefined, color: string, cx: number, cy: number, size: number): string {
  const slug = name === undefined ? undefined : LANGUAGE_SLUGS[name];
  const brand = slug === undefined ? undefined : brandBySlug(slug);
  if (brand === undefined) return el('circle', { cx, cy, r: size * 0.35, fill: color });
  return el(
    'svg',
    { x: cx - size / 2, y: cy - size / 2, width: size, height: size, viewBox: '0 0 24 24' },
    el('path', { d: brand.path, fill: color })
  );
}
