import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/main.ts' },
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: true,
  fixedExtension: false,
  // Bundled deps (subset-font's Emscripten/harfbuzz wasm loader) reference
  // CommonJS `__dirname`, which is undefined in the ESM output; inject shims.
  shims: true,
  deps: {
    alwaysBundle: [/.*/],
  },
});
