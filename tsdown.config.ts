import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/main.ts' },
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: true,
  fixedExtension: false,
  deps: {
    alwaysBundle: [/.*/],
  },
});
