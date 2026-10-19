import { createSolidBase } from '@kobalte/solidbase/config';
import defaultTheme from '@kobalte/solidbase/default-theme';
import { solidStart } from '@solidjs/start/config';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const solidBase = createSolidBase(defaultTheme);

export default defineConfig({
  plugins: [
    {
      // The default theme's header imports DocSearch statically, which adds
      // ~490 kB to every page, though it only renders when search is set up
      name: 'aniscore:no-docsearch',
      enforce: 'pre',
      resolveId(id, importer) {
        if (
          id.endsWith('/vendor/DocSearch.jsx')
          && importer?.includes('@kobalte/solidbase')
        )
          return '\0aniscore:no-docsearch';
      },
      load(id) {
        if (id === '\0aniscore:no-docsearch')
          return 'export default function DocSearch() { return null; }';
      },
    },
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
      preset: 'static',
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
