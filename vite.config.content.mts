import type { UserConfig } from 'vite'
import { build, mergeConfig } from 'vite'
import { contentScripts } from '~/utils/contentScripts'
import { isDev, mode, r } from './scripts/utils'
import { injectEngageWithSite } from './scripts/vite-plugin-inject-engage'
import { sharedDOMConfig } from './vite.config.mjs'

await Promise.all(contentScripts.map(async (entry) => {
  const base = `dist/contentScripts/${entry.directory}`
  return build(mergeConfig(sharedDOMConfig({
    unoCSS: !entry.directory.includes('site/') && !entry.directory.includes('root/'),
  }), {
    mode,
    // base: '/__dynamic_base__/',
    plugins: [
      injectEngageWithSite(['**/contentScripts/site/*/main.{ts,tsx}']),
      // dynamicBase({
      //   // dynamic public path var string, default window.__dynamic_base__
      //   publicPath: `chrome.extension.getURL("${base}")`,
      //   // dynamic load resources on index.html, default false. maybe change default true
      //   transformIndexHtml: false,
      //   // provide conversion configuration parameters. by 1.1.0
      //   // transformIndexHtmlConfig: { insertBodyAfter: false }
      // }),
    ],
    build: {
      watch: isDev
        ? {}
        : undefined,
      outDir: r(`extension/${base}`),
      cssCodeSplit: false,
      emptyOutDir: false,
      // lib: {
      //   entry: entry.path,
      //   name: entry.name,
      //   // formats: ['es'],
      //   formats: ['es'],
      // },
      rollupOptions: {
        input: {
          [entry.name]: entry.path,
        },
        output: {
          // entryFileNames: entry.name,
          // // inlineDynamicImports: true,
          // extend: true,
          // format: 'iife',

          inlineDynamicImports: true,
          format: 'iife',
          name: 'TBD',
          entryFileNames: `[name]`,
          assetFileNames: `[name][extname]`,
        },
      },
    },
  } as UserConfig))
}))
