import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { createSolidBase } from '@kobalte/solidbase/config';
import defaultTheme from '@kobalte/solidbase/default-theme';
import { solidStart } from '@solidjs/start/config';
import { nitro } from 'nitro/vite';
import { defineConfig, type Plugin } from 'vite';

const solidBase = createSolidBase(defaultTheme);

// The default theme's header imports DocSearch statically, which adds
// ~490 kB to every page, though it only renders when search is set up
function noDocSearch(): Plugin {
  const stubId = '\0aniscore:no-docsearch';
  let isBuild = false;
  let stubbed = false;

  return {
    name: 'aniscore:no-docsearch',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(id, importer) {
      if (
        id.endsWith('/vendor/DocSearch.jsx')
        && importer?.includes('@kobalte/solidbase')
      ) {
        stubbed = true;
        return stubId;
      }
    },
    load(id) {
      if (id === stubId)
        return 'export default function DocSearch() { return null; }';
    },
    buildEnd(error) {
      if (isBuild && !error && !stubbed)
        this.error(
          "SolidBase's header no longer imports vendor/DocSearch.jsx, so the stub doesn't apply",
        );
    },
  };
}

export default defineConfig({
  plugins: [
    noDocSearch(),
    solidBase.plugin({
      title: 'AniScore',
      titleTemplate: ':title | AniScore',
      description:
        'See anime ratings, genres, and your watch progress directly on streaming sites. Powered by AniList.',
      logo: '/logo.svg',
      lang: 'en',
      editPath: 'https://github.com/seahindeniz/ani-score/edit/main/:path',
      lastUpdated: { dateStyle: 'medium' },
      themeConfig: {
        fonts: {
          jetbrainsMono: false,
        },
        socialLinks: {
          github: 'https://github.com/seahindeniz/ani-score',
        },
        nav: [
          {
            text: 'Guide',
            link: '/guide',
          },
        ],
        sidebar: {
          '/guide': [
            {
              title: 'Getting Started',
              collapsed: false,
              items: [
                {
                  title: 'What is AniScore?',
                  link: '/',
                },
                {
                  title: 'Installation',
                  link: '/installation',
                },
              ],
            },
            {
              title: 'Features',
              collapsed: false,
              items: [
                {
                  title: 'Ratings & Details',
                  link: '/ratings',
                },
                {
                  title: 'Watch Tracking',
                  link: '/watch-tracking',
                },
                {
                  title: 'Add a Site',
                  link: '/add-a-site',
                },
              ],
            },
          ],
        },
      },
      locales: {
        tr: {
          label: 'Türkçe',
          themeConfig: {
            nav: [
              {
                text: 'Rehber',
                link: '/guide',
              },
            ],
            sidebar: {
              '/guide': [
                {
                  title: 'Başlangıç',
                  collapsed: false,
                  items: [
                    {
                      title: 'AniScore Nedir?',
                      link: '/',
                    },
                    {
                      title: 'Kurulum',
                      link: '/installation',
                    },
                  ],
                },
                {
                  title: 'Özellikler',
                  collapsed: false,
                  items: [
                    {
                      title: 'Puanlama ve Detaylar',
                      link: '/ratings',
                    },
                    {
                      title: 'İzleme Takibi',
                      link: '/watch-tracking',
                    },
                    {
                      title: 'Site Ekleme',
                      link: '/add-a-site',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    }),
    solidStart(solidBase.startConfig()),
    nitro({
      // Static, plus a prerendered 404.html that GitHub Pages serves for unknown paths
      preset: 'github-pages',
      modules: [
        {
          // The client build's Vite manifest would otherwise be published with the site.
          // A module adds the hook, where `hooks` would replace the preset's own `compiled` hook
          setup(nitro) {
            nitro.hooks.hook('compiled', () =>
              rm(join(nitro.options.output.publicDir, '.vite'), {
                recursive: true,
                force: true,
              }),
            );
          },
        },
      ],
      prerender: {
        crawlLinks: true,
        // Otherwise a page that fails to render is skipped, and the build still deploys
        failOnError: true,
        routes: [
          '/',
          '/tr',
          '/tr/guide',
          '/tr/guide/installation',
          '/tr/guide/ratings',
          '/tr/guide/watch-tracking',
          '/tr/guide/add-a-site',
        ],
      },
    }),
  ],
  environments: {
    client: {
      build: {
        target: 'esnext',
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: 'solid-runtime',
                  test: /node_modules\/solid-js\//,
                },
                {
                  name: 'router',
                  test: /node_modules\/@solidjs\/router\//,
                },
                {
                  name: 'kobalte',
                  test: /node_modules\/@kobalte\/core\//,
                },
              ],
            },
          },
        },
      },
    },
  },
});
