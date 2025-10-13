/// <reference types="vitest" />

import type { UserConfig } from 'vite'
import { dirname, relative } from 'node:path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig, mergeConfig } from 'vite'
import solid from 'vite-plugin-solid'
import packageJson from './package.json'
import { isDev, mode, port, r } from './scripts/utils'

export const sharedConfig: UserConfig = {
  root: r('src'),
  resolve: {
    alias: {
      '~/': `${r('src')}/`,
    },
    conditions: ['development', 'browser'],
  },
  define: {
    '__DEV__': isDev,
    '__NAME__': JSON.stringify(packageJson.name),
    // https://github.com/vitejs/vite/issues/9320
    // https://github.com/vitejs/vite/issues/9186
    'process.env.NODE_ENV': JSON.stringify(mode),

  },
  plugins: [
    solid(),
    AutoImport({
      imports: [
        {
          'webextension-polyfill': [
            ['=', 'browser'],
          ],
        },
      ],
      dts: r('src/auto-imports.d.ts'),
    }),
  ],
  build: {
    cssMinify: !isDev,
    minify: !isDev,
    sourcemap: isDev && 'inline',
  },
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  optimizeDeps: {
    include: [
      'solid-js',
      'solid-js/web',
      'webextension-polyfill',
    ],
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
}

export function sharedDOMConfig(props: { icons?: boolean, unoCSS?: boolean } = {}) {
  const propsWithDefaults = {
    icons: true,
    unoCSS: true,
    ...props,
  }

  return mergeConfig(sharedConfig, {
    plugins: [
      propsWithDefaults.icons && Icons({ compiler: 'solid' }),
      propsWithDefaults.unoCSS && UnoCSS(),

      // rewrite assets to use relative path
      {
        name: 'assets-rewrite',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html, { path }) {
          return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
        },
      },
    ],
  } as UserConfig)
}

export default defineConfig(({ command }) => mergeConfig(sharedDOMConfig(), {
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
    origin: `http://localhost:${port}`,
  },
  build: {
    watch: isDev
      ? {}
      : undefined,
    outDir: r('extension/dist'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    target: 'esnext',
    rollupOptions: {
      input: {
        options: r('src/options/index.html'),
        popup: r('src/popup/index.html'),
        sidepanel: r('src/sidepanel/index.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
}))
