import { dirname, relative } from 'node:path';
import process from 'node:process';

import presetRemToPx from '@unocss/preset-rem-to-px';
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Icons from 'unplugin-icons/vite';
import type { UserConfig } from 'vite';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import solid from 'vite-plugin-solid';

import packageJson from './package.json' with { type: 'json' };
import {
  isDev,
  isFirefox,
  mode,
  port,
  r,
  targetBrowser,
} from './scripts/utils.ts';
import unoConfig from './unocss.config.ts';

// Vite runs on Bun through the `node` alias, where Bun doesn't load `.env` itself.
// Variables set in the environment (e.g. by CI) take precedence.
const env = { ...loadEnv(mode, r(), ''), ...process.env };
const ANILIST_TOKEN_URL = isFirefox
  ? env.ANILIST_TOKEN_URL_FIREFOX
  : env.ANILIST_TOKEN_URL;

export const sharedConfig: UserConfig = {
  root: r('src'),
  resolve: {
    alias: {
      '~/': `${r('src')}/`,
    },
    conditions: ['development', 'browser'],
  },
  define: {
    __DEV__: isDev,
    __NAME__: JSON.stringify(packageJson.name),
    // https://github.com/vitejs/vite/issues/9320
    // https://github.com/vitejs/vite/issues/9186
    'process.env.NODE_ENV': JSON.stringify(mode),
    ANILIST_TOKEN_URL: JSON.stringify(ANILIST_TOKEN_URL ?? ''),
    __TARGET_BROWSER__: JSON.stringify(targetBrowser),
  },
  plugins: [
    solid({
      solid: {
        delegateEvents: false,
      },
    }),
    AutoImport({
      imports: [
        {
          'webextension-polyfill': [['=', 'browser']],
        },
      ],
      dts: r('src/auto-imports.d.ts'),
    }),
  ],
  build: {
    cssMinify: false,
    minify: false,
    rolldownOptions: {
      output: {
        // Compress syntax and whitespace, but keep names readable (e.g. for add-on store review)
        minify: {
          compress: true,
          mangle: false,
          codegen: { removeWhitespace: true },
        },
      },
    },
    // Inline sourcemaps made the content scripts ~3.5x larger, and they're parsed on every matching page
    sourcemap: isDev ? 'inline' : false,
  },
  optimizeDeps: {
    include: ['solid-js', 'solid-js/web', 'webextension-polyfill'],
    exclude: [],
  },
  css: {
    preprocessorOptions: {
      scss: {
        // @ts-expect-error -- IGNORE --
        api: 'modern-compiler', // or "modern"
      },
    },
  },
};

export function sharedDOMConfig(
  props: { icons?: boolean; unoCSS?: boolean; remToPx?: boolean } = {},
) {
  const propsWithDefaults = {
    icons: true,
    unoCSS: true,
    remToPx: false,
    ...props,
  };

  return mergeConfig(sharedConfig, {
    plugins: [
      propsWithDefaults.icons && Icons({ compiler: 'solid' }),
      propsWithDefaults.unoCSS
        && UnoCSS(
          propsWithDefaults.remToPx
            ? // Content scripts render inside the host page, where `rem` follows the site's root font size (e.g. 10px on
              // tranimeizle), so their sizes are emitted in px at the default 16px base. Extension pages keep rem, so they
              // still follow the user's browser font size.
              {
                ...unoConfig,
                configFile: false,
                presets: [...(unoConfig.presets ?? []), presetRemToPx()],
              }
            : undefined,
        ),

      // rewrite assets to use relative path
      {
        name: 'assets-rewrite',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html, { path }) {
          return html.replace(
            /"\/assets\//g,
            `"${relative(dirname(path), '/assets')}/`,
          );
        },
      },
    ],
  } as UserConfig);
}

export default defineConfig(({ command }) =>
  mergeConfig(sharedDOMConfig(), {
    base:
      command === 'serve' && !isFirefox
        ? `http://localhost:${port}/`
        : '/dist/',
    server: {
      port,
      hmr: {
        host: 'localhost',
      },
      origin: `http://localhost:${port}`,
    },
    build: {
      watch: isDev ? {} : undefined,
      outDir: r('extension/dist'),
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      target: 'esnext',
      rolldownOptions: {
        input: {
          options: r('src/options/index.html'),
          popup: r('src/popup/index.html'),
          sidepanel: r('src/sidepanel/index.html'),
        },
      },
    },
  }),
);
