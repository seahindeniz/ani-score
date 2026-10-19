import { spyOn } from 'bun:test';

import type { AnimeData } from '~/logic';

import { buildAnimeIndex, packAnimeIndex } from '../logic/animeIndex';
import { sha256 } from '../logic/databaseSources';

type Handler = (request: Request) => Response | Promise<Response>;

export const databaseURLs = {
  primaryLastUpdate:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json',
  primary:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/anime-offline-database-minified.json',
  fallbackLastUpdate:
    'https://api.github.com/repos/athanasso/anime-offline-database/releases/latest',
  fallback:
    'https://github.com/athanasso/anime-offline-database/releases/latest/download/anime-offline-database-minified.json',
};

export const prebuiltURLs = {
  metadata: 'https://aniscore.link/anime-index-v1.json',
  index: 'https://aniscore.link/anime-index-v1.bin.gz',
};

export const anilistURL = 'https://graphql.anilist.co/';

export const databaseEntries = [
  {
    title: 'Sousou no Frieren',
    type: 'TV',
    sources: [
      'https://myanimelist.net/anime/52991',
      'https://anilist.co/anime/154587',
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
    sources: ['https://myanimelist.net/anime/60000'],
    synonyms: ['The Apothecary Diaries Season 3'],
  },
  {
    title: 'Twin Title',
    type: 'MOVIE',
    sources: ['https://anilist.co/anime/1'],
    synonyms: [],
  },
  {
    title: 'Twin Title',
    type: 'TV',
    sources: ['https://anilist.co/anime/2'],
    synonyms: [],
  },
  {
    title: 'Kitsu Only Anime',
    type: 'TV',
    sources: ['https://kitsu.app/anime/1'],
    synonyms: [],
  },
] as AnimeData[];

/**
 * Answers `fetch` by URL; unknown URLs get a 404. A non-function value is sent as JSON.
 */
export function mockFetch(routes: Record<string, Handler | object>) {
  return spyOn(globalThis, 'fetch').mockImplementation((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const request = new Request(input, init);
    const route = routes[request.url];

    if (route === undefined) return new Response('Not Found', { status: 404 });

    return typeof route === 'function' ? route(request) : Response.json(route);
  }) as typeof fetch);
}

export function databaseRoutes(
  options: { lastUpdate?: string; entries?: AnimeData[] } = {},
) {
  const { lastUpdate = '2026-10-01', entries = databaseEntries } = options;

  return {
    [databaseURLs.primaryLastUpdate]: { lastUpdate },
    [databaseURLs.primary]: { data: entries },
  };
}

/**
 * The site's prebuilt index of the entries, as `scripts/anime-index.ts` publishes it. Its download URL carries the
 * file's SHA-256, which `indexURL` gives.
 */
export async function prebuiltRoutes(
  options: {
    lastUpdate?: string;
    entries?: AnimeData[];
    /**
     * When the site last built it.
     * @default now
     */
    checkedAt?: number;
    format?: number;
    /**
     * Served as the index in place of the packed entries, e.g. a truncated copy.
     */
    serve?: (file: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
  } = {},
) {
  const {
    lastUpdate = '2026-10-01',
    entries = databaseEntries,
    checkedAt = Date.now(),
    format = 1,
    serve = (file: Uint8Array<ArrayBuffer>) => Bun.gzipSync(file),
  } = options;
  const file = packAnimeIndex(buildAnimeIndex(entries).stored);
  const hash = await sha256(file);
  const indexURL = `${prebuiltURLs.index}?sha256=${hash}`;

  return {
    indexURL,
    routes: {
      [prebuiltURLs.metadata]: {
        format,
        source: 'cedya77/anime-offline-database',
        lastUpdate,
        checkedAt: new Date(checkedAt).toISOString(),
        sha256: hash,
      },
      [indexURL]: () => new Response(serve(file)),
    },
  };
}

export interface AnimeLookup {
  alias: string;
  by: string;
  value: string;
}

export function parseLookups(query: string): AnimeLookup[] {
  const pattern =
    /(a_\d+_\w*)\s*:\s*Page\s*\([^)]*\)\s*\{\s*results\s*:\s*media\s*\(([^)]*)\)/g;

  return Array.from(query.matchAll(pattern), ([, alias, args]) => {
    const [, by, value] =
      args.match(/\b(id|idMal|search)\s*:\s*(\d+|"(?:[^"\\]|\\.)*")/) ?? [];

    return { alias, by, value };
  });
}

/**
 * An AniList stand-in that answers batch lookups with the media whose `id` (or `idMal`) matches.
 */
export function anilistHandler(
  media: { id: number; idMal?: number }[],
  requests: {
    query: string;
    variables?: Record<string, unknown>;
    headers: Headers;
  }[] = [],
): Handler {
  return async (request) => {
    const body = (await request.json()) as {
      query: string;
      variables?: Record<string, unknown>;
    };

    requests.push({ ...body, headers: request.headers });

    const data = Object.fromEntries(
      parseLookups(body.query).map(({ alias, by, value }) => {
        const match = media.find(
          (item) =>
            (by === 'id' && item.id === Number(value))
            || (by === 'idMal' && item.idMal === Number(value)),
        );

        return [alias, { results: match ? [match] : [] }];
      }),
    );

    return Response.json({ data });
  };
}
