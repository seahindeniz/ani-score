import type { AnimeData } from '@ani-score/anime-index';
import {
  buildAnimeIndex,
  createPrebuiltIndex,
  prebuiltIndexURLs,
} from '@ani-score/anime-index';
import type { BrowserContext, Route } from '@playwright/test';

/**
 * The fields of an anime-offline-database entry that the extension indexes.
 */
export interface DatabaseEntry {
  title: string;
  type: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'UNKNOWN';
  sources: string[];
  synonyms: string[];
}

export interface MediaFixture {
  id: number;
  idMal?: number;
  title: string;
  favourites?: number;
  isFavourite?: boolean;
  popularity?: number;
  episodes?: number;
  genres?: string[];
  tags?: string[];
  /**
   * Episodes the viewer has watched; set to show the anime as being watched.
   */
  progress?: number;
  startDate?: Date;
}

export const database: DatabaseEntry[] = [
  {
    title: 'Sousou no Frieren',
    type: 'TV',
    sources: [
      'https://anilist.co/anime/154587',
      'https://myanimelist.net/anime/52991',
    ],
    synonyms: ["Frieren: Beyond Journey's End"],
  },
  {
    title: 'Kusuriya no Hitorigoto',
    type: 'TV',
    sources: [
      'https://anilist.co/anime/161645',
      'https://myanimelist.net/anime/54492',
    ],
    synonyms: ['The Apothecary Diaries'],
  },
  {
    title: 'Kusuriya no Hitorigoto 3rd Season',
    type: 'TV',
    // Only a MyAnimeList source, so AniList is queried by `idMal`
    sources: ['https://myanimelist.net/anime/60000'],
    synonyms: ['The Apothecary Diaries Season 3'],
  },
  {
    title: 'Kitsu Only Anime',
    type: 'TV',
    // Neither AniList nor MyAnimeList, so the extension drops this entry
    sources: ['https://kitsu.app/anime/1'],
    synonyms: [],
  },
];

export const frieren: MediaFixture = {
  id: 154587,
  title: "Frieren: Beyond Journey's End",
  favourites: 1234,
  popularity: 250000,
  episodes: 28,
  genres: ['Adventure', 'Drama', 'Fantasy'],
  tags: [
    'Elf',
    'Magic',
    'Travel',
    'Time Skip',
    'Iyashikei',
    'Female Protagonist',
  ],
  startDate: new Date('2023-09-29'),
};

export const apothecaryDiaries: MediaFixture = {
  id: 161645,
  title: 'The Apothecary Diaries',
  favourites: 800,
  popularity: 180000,
  genres: ['Drama', 'Mystery'],
};

export const apothecaryDiariesSeason3: MediaFixture = {
  id: 190001,
  idMal: 60000,
  title: 'The Apothecary Diaries Season 3',
  favourites: 500,
  popularity: 40000,
  genres: ['Mystery'],
  // Released 10 days ago with 500 favourites, which counts as trending
  startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
};

export const genreCollection = [
  'Action',
  'Adventure',
  'Drama',
  'Fantasy',
  'Mystery',
];

const databaseURLs = {
  primaryLastUpdate:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json',
  primary:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/anime-offline-database-minified.json',
  fallbackLastUpdate:
    'https://api.github.com/repos/athanasso/anime-offline-database/releases/latest',
  fallback:
    'https://github.com/athanasso/anime-offline-database/releases/latest/download/anime-offline-database-minified.json',
};

export interface AnimeLookup {
  alias: string;
  by: 'id' | 'idMal' | 'search';
  value: string;
}

function toMedia(fixture: MediaFixture) {
  const { startDate } = fixture;

  return {
    id: fixture.id,
    episodes: fixture.episodes ?? 12,
    favourites: fixture.favourites ?? 0,
    isFavourite: fixture.isFavourite ?? false,
    popularity: fixture.popularity ?? 0,
    genres: fixture.genres ?? [],
    description: `${fixture.title} description`,
    status: 'FINISHED',
    format: 'TV',
    season: 'FALL',
    seasonYear: 2023,
    title: { userPreferred: fixture.title, romaji: fixture.title },
    mediaListEntry:
      fixture.progress == null ? null : { progress: fixture.progress },
    nextAiringEpisode: null,
    tags: (fixture.tags ?? []).map((name, index) => ({
      name,
      rank: 100 - index,
    })),
    startDate: startDate
      ? {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        }
      : null,
    coverImage: { extraLarge: null, large: null },
    relations: { edges: [] },
    characterPreview: { edges: [] },
  };
}

// e.g. `a_1_sousou_no_frieren: Page(perPage: 1) { results: media(type: ANIME, id: 154587) {`
const lookupPattern =
  /(a_\d+_\w*)\s*:\s*Page\s*\([^)]*\)\s*\{\s*results\s*:\s*media\s*\(([^)]*)\)/g;
const lookupArgumentPattern =
  /\b(id|idMal|search)\s*:\s*(\d+|"(?:[^"\\]|\\.)*")/;

function parseLookups(query: string): AnimeLookup[] {
  return Array.from(query.matchAll(lookupPattern), ([, alias, args]) => {
    const [, by, value] = args.match(lookupArgumentPattern) ?? [];

    return {
      alias,
      by: by as AnimeLookup['by'],
      value: value?.replace(/^"|"$/g, ''),
    };
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Serves the anime database, AniList and site pages from fixtures, and blocks every other outside HTTP request,
 * so tests neither depend on nor reach real services. The background's keep-alive WebSocket is the exception: it
 * opens when the service worker starts, before any route exists.
 */
export async function mockNetwork(
  context: BrowserContext,
  options: {
    media?: MediaFixture[];
    /**
     * Makes the site's prebuilt index unavailable, so the upstream sources are used.
     * @default false
     */
    prebuiltIndexDown?: boolean;
    /**
     * Makes the preferred upstream source fail, so the fallback source is used.
     * @default false
     */
    primaryDatabaseDown?: boolean;
    /**
     * HTML bodies keyed by page URL.
     */
    pages?: Record<string, string>;
  } = {},
) {
  const {
    media = [],
    prebuiltIndexDown = false,
    primaryDatabaseDown = false,
    pages = {},
  } = options;
  const recorded = {
    lookups: [] as AnimeLookup[],
    authorizations: [] as (string | undefined)[],
    favoriteToggles: [] as number[],
    databaseDownloads: [] as string[],
  };

  // Routes registered later take precedence, so this only catches what nothing below handles
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) =>
    route.abort('blockedbyclient'),
  );

  await context.route(databaseURLs.primaryLastUpdate, (route) =>
    primaryDatabaseDown
      ? route.fulfill({ status: 404 })
      : json(route, { lastUpdate: '2026-10-01' }),
  );
  await context.route(databaseURLs.fallbackLastUpdate, (route) =>
    json(route, { published_at: '2026-10-01T00:00:00Z' }),
  );

  // The site's prebuilt index, built from the same entries as the upstream database
  const prebuilt = await createPrebuiltIndex(
    { source: 'cedya77/anime-offline-database', lastUpdate: '2026-10-01' },
    buildAnimeIndex(database as unknown as AnimeData[]).stored,
  );
  await context.route(prebuiltIndexURLs.metadata, (route) =>
    prebuiltIndexDown
      ? route.fulfill({ status: 404 })
      : json(route, prebuilt.metadata),
  );
  await context.route(
    (url) => url.href.startsWith(prebuiltIndexURLs.index),
    (route) => {
      recorded.databaseDownloads.push(route.request().url());

      return route.fulfill({ body: Buffer.from(Bun.gzipSync(prebuilt.file)) });
    },
  );

  for (const url of [databaseURLs.primary, databaseURLs.fallback]) {
    await context.route(url, (route) => {
      recorded.databaseDownloads.push(url);

      return json(route, { data: database });
    });
  }

  await context.route('https://graphql.anilist.co/', async (route) => {
    const request = route.request();
    const { query, variables } = request.postDataJSON() as {
      query: string;
      variables?: Record<string, unknown>;
    };

    recorded.authorizations.push(
      (await request.headerValue('authorization')) ?? undefined,
    );

    if (query.includes('ToggleFavourite')) {
      recorded.favoriteToggles.push(variables?.animeId as number);

      return json(route, {
        data: {
          ToggleFavourite: {
            anime: { pageInfo: { total: 1 } },
            manga: null,
            characters: null,
            staff: null,
            studios: null,
          },
        },
      });
    }

    if (query.includes('GenreCollection')) {
      return json(route, { data: { GenreCollection: genreCollection } });
    }

    const lookups = parseLookups(query);

    recorded.lookups.push(...lookups);

    const data = Object.fromEntries(
      lookups.map(({ alias, by, value }) => {
        const match = media.find(
          (item) =>
            (by === 'id' && item.id === Number(value))
            || (by === 'idMal' && item.idMal === Number(value))
            || (by === 'search' && item.title === value),
        );

        return [
          alias,
          {
            pageInfo: { hasNextPage: false },
            results: match ? [toMedia(match)] : [],
          },
        ];
      }),
    );

    return json(route, { data });
  });

  for (const [url, body] of Object.entries(pages)) {
    await context.route(url, (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body }),
    );
  }

  return recorded;
}

export function anizmNewEpisodesPage(
  cards: { title: string; episode: number }[],
) {
  const articles = cards
    .map(
      (card) => `
    <article class="v3-episode-card">
      <div class="v3-poster-frame"></div>
      <div class="v3-card-copy">
        <h3>${card.title}</h3>
        <span>${card.episode}. Bölüm </span>
      </div>
    </article>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Anizm</title></head><body><div class="v3-latest-grid">${articles}</div></body></html>`;
}

export function tranimeizleHomePage(
  cardTitles: string[],
  theme: 'dark' | 'light',
) {
  const blocks = cardTitles
    .map(
      (title) => `
    <div class="flx-block">
      <a class="news-image" href="#"></a>
      <div class="bar"><h4>${title}</h4></div>
    </div>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>TRanimeizle</title>
    <script>localStorage.setItem('temabuton', '${theme}')</script>
    </head><body class="${theme}-mode"><div class="flex-wrap-layout">${blocks}</div></body></html>`;
}
