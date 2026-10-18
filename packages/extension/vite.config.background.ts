import type { UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';

import packageJson from './package.json' with { type: 'json' };
import { r } from './scripts/utils.ts';
import { sharedConfig } from './vite.config.ts';

// bundling the content script using Vite
export default defineConfig(({ mode }) =>
  mergeConfig(sharedConfig, {
    base: '/dist/background',
    build: {
      watch: mode !== 'production' ? {} : undefined,
      outDir: r('extension/dist/background'),
      cssCodeSplit: false,
      emptyOutDir: false,
      sourcemap: mode !== 'production' ? 'inline' : false,
      lib: {
        entry: r('src/background/main.ts'),
        name: packageJson.name,
        formats: ['iife'],
      },
      rolldownOptions: {
        output: {
          entryFileNames: 'index.mjs',
          extend: true,
        },
      },
    },
  } as UserConfig),
);
