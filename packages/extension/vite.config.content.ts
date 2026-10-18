import type { UserConfig } from 'vite';
import { build, mergeConfig } from 'vite';

import { isDev, mode, r } from './scripts/utils';
import { inlineCss } from './scripts/vite-plugin-inline-css';
import { contentScriptPaths } from './src/utils/contentScripts';
import { sharedDOMConfig } from './vite.config.js';

await Promise.all(
  contentScriptPaths.map(async (entry) => {
    const base = `dist/contentScripts/${entry.directory}`;
    return build(
      mergeConfig(
        sharedDOMConfig({
          unoCSS: !entry.directory.includes('root/'),
          remToPx: true,
        }),
        {
          mode,
          // base: '/__dynamic_base__/',
          plugins: [
            inlineCss(),
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
            watch: isDev ? {} : undefined,
            outDir: r(`extension/${base}`),
            cssCodeSplit: false,
            emptyOutDir: false,
            // lib: {
            //   entry: entry.path,
            //   name: entry.name,
            //   // formats: ['es'],
            //   formats: ['es'],
            // },
            rolldownOptions: {
              input: {
                [entry.name]: entry.path,
              },
              output: {
                // entryFileNames: entry.name,
                // extend: true,
                // format: 'iife',

                format: 'iife',
                name: 'TBD',
                entryFileNames: `[name]`,
                assetFileNames: `[name][extname]`,
              },
            },
          },
        } as UserConfig,
      ),
    );
  }),
);
