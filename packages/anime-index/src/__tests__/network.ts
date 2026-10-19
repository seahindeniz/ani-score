import { spyOn } from 'bun:test';

import type { AnimeData } from '../animeData';
import { buildAnimeIndex } from '../animeIndex';
import { prebuiltIndexURLs } from '../databaseSources';
import { createPrebuiltIndex, prebuiltIndexDownloadURL } from '../publish';

type Handler = (request: Request) => Response | Promise<Response>;

export const upstreamURLs = {
  cedya77LastUpdate:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json',
  cedya77:
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/anime-offline-database-minified.json',
  athanassoRelease:
    'https://api.github.com/repos/athanasso/anime-offline-database/releases/latest',
  athanasso:
    'https://github.com/athanasso/anime-offline-database/releases/latest/download/anime-offline-database-minified.json',
};

export const entries = [
  {
    title: 'Sousou no Frieren',
    type: 'TV',
    sources: ['https://anilist.co/anime/154587'],
    synonyms: ["Frieren: Beyond Journey's End"],
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

/**
 * The site's index of the entries and its metadata, as published.
 */
export async function prebuiltRoutes(
  options: {
    source?: string;
    checkedAt?: number;
    format?: number;
    serve?: (file: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
  } = {},
) {
  const {
    source,
    checkedAt = Date.now(),
    format = 1,
    serve = (file: Uint8Array<ArrayBuffer>) => Bun.gzipSync(file),
  } = options;
  const { metadata, file } = await createPrebuiltIndex(
    { source: 'cedya77/anime-offline-database', lastUpdate: '2026-10-01' },
    buildAnimeIndex(entries).stored,
    new Date(checkedAt),
  );

  return {
    // `format` and `source` can be ones the site would never publish
    [prebuiltIndexURLs.metadata]: {
      ...metadata,
      format,
      source: source ?? metadata.source,
    },
    [prebuiltIndexDownloadURL(metadata)]: () => new Response(serve(file)),
  };
}

/**
 * A response whose connection drops after the first bytes.
 */
export const brokenOff = (start: string) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(start));
        controller.error(new TypeError('Connection reset'));
      },
    }),
  );
