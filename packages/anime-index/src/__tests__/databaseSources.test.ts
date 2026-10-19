import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { buildAnimeIndex, packAnimeIndex } from '../animeIndex';
import {
  fetchRelease,
  prebuiltIndexURLs,
  prebuiltSource,
  upstreamSources,
} from '../databaseSources';
import {
  brokenOff,
  entries,
  mockFetch,
  prebuiltRoutes,
  upstreamURLs,
} from './network';

const [cedya77, athanasso] = upstreamSources;
const realSetTimeout = globalThis.setTimeout;

let fetchMock: ReturnType<typeof mockFetch> | undefined;
let timeoutSpy: ReturnType<typeof spyOn>;
const retries: [number, number][] = [];
const onRetry = (attempt: number, of: number) => retries.push([attempt, of]);

const requested = (url: string) =>
  fetchMock!.mock.calls.filter(([input]) => String(input) === url).length;

beforeEach(() => {
  retries.length = 0;
  // The pauses between retries take seconds; run them right away
  timeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
  ) => realSetTimeout(callback, 0)) as typeof setTimeout);
});

afterEach(() => {
  fetchMock?.mockRestore();
  fetchMock = undefined;
  timeoutSpy.mockRestore();
});

describe('fetchRelease', () => {
  test('asks again after a failed request', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      [upstreamURLs.cedya77LastUpdate]: () => {
        attempts++;

        if (attempts === 1) throw new TypeError('Failed to fetch');

        return Response.json({ lastUpdate: '2026-10-01' });
      },
    });

    expect(await fetchRelease(cedya77, onRetry)).toMatchObject({
      source: 'cedya77/anime-offline-database',
      lastUpdate: '2026-10-01',
    });
    expect(retries).toEqual([[1, 3]]);
  });

  test('gives up after three retries of a server error', async () => {
    fetchMock = mockFetch({
      [upstreamURLs.cedya77LastUpdate]: () =>
        new Response('Server Error', { status: 500 }),
    });

    await expect(fetchRelease(cedya77, onRetry)).rejects.toThrow('500');
    expect(requested(upstreamURLs.cedya77LastUpdate)).toBe(4);
  });

  test('asks again after a response that broke off', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      [upstreamURLs.cedya77LastUpdate]: () =>
        ++attempts === 1
          ? brokenOff('{"lastUpdate": "2026-')
          : Response.json({ lastUpdate: '2026-10-01' }),
    });

    expect((await fetchRelease(cedya77, onRetry)).lastUpdate).toBe(
      '2026-10-01',
    );
    expect(attempts).toBe(2);
  });

  test("doesn't ask again for what asking again won't fix", async () => {
    fetchMock = mockFetch({
      // A captive portal's page, arrived whole
      [upstreamURLs.cedya77LastUpdate]: () =>
        new Response('<html>Sign in to the network</html>'),
      // No `published_at`, so reading its date throws a TypeError
      [upstreamURLs.athanassoRelease]: { name: 'latest' },
    });

    await expect(fetchRelease(cedya77, onRetry)).rejects.toThrow(SyntaxError);
    await expect(fetchRelease(athanasso, onRetry)).rejects.toThrow(TypeError);
    // Missing
    await expect(fetchRelease(prebuiltSource, onRetry)).rejects.toThrow('404');
    expect(retries).toEqual([]);
  });

  test("rejects an update date it can't parse", async () => {
    fetchMock = mockFetch({
      [upstreamURLs.cedya77LastUpdate]: { lastUpdate: 'not a date' },
    });

    await expect(fetchRelease(cedya77, onRetry)).rejects.toThrow(
      'Invalid last update date',
    );
  });
});

describe('upstream sources', () => {
  test('date a release by their update check, and index its download', async () => {
    fetchMock = mockFetch({
      [upstreamURLs.cedya77LastUpdate]: { lastUpdate: '2026-10-01' },
      [upstreamURLs.cedya77]: { data: entries },
      [upstreamURLs.athanassoRelease]: {
        published_at: '2026-10-02T12:00:00Z',
      },
      [upstreamURLs.athanasso]: { data: entries },
    });

    for (const [source, lastUpdate] of [
      [cedya77, '2026-10-01'],
      [athanasso, '2026-10-02'],
    ] as const) {
      const release = await source.fetchRelease();

      expect(release).toMatchObject({ source: source.name, lastUpdate });
      expect(
        (await release.download()).index.search('Frieren', 10),
      ).toMatchObject([{ title: 'Sousou no Frieren' }]);
    }
  });
});

describe('prebuilt index', () => {
  test('names the upstream source it was built from, and is searchable once downloaded', async () => {
    fetchMock = mockFetch(await prebuiltRoutes());

    const release = await prebuiltSource.fetchRelease();

    expect(release).toMatchObject({
      source: 'cedya77/anime-offline-database',
      lastUpdate: '2026-10-01',
    });
    expect((await release.download()).index.search('Frieren', 10)).toHaveLength(
      1,
    );
  });

  test('is refused when built from a source other than the preferred one', async () => {
    fetchMock = mockFetch(
      await prebuiltRoutes({ source: 'athanasso/anime-offline-database' }),
    );

    await expect(prebuiltSource.fetchRelease()).rejects.toThrow();
  });

  test('is also read when served decompressed', async () => {
    fetchMock = mockFetch(await prebuiltRoutes({ serve: (file) => file }));

    const release = await prebuiltSource.fetchRelease();

    expect((await release.download()).index.search('Frieren', 10)).toHaveLength(
      1,
    );
  });

  test("is refused when it doesn't match its SHA-256", async () => {
    // A well-formed index, but not the one the metadata describes, as a cache could still hold an older one
    fetchMock = mockFetch(
      await prebuiltRoutes({
        serve: () => Bun.gzipSync(packAnimeIndex(buildAnimeIndex([]).stored)),
      }),
    );

    const release = await prebuiltSource.fetchRelease();

    await expect(release.download()).rejects.toThrow('SHA-256');
  });

  test('is refused once the site stopped building it', async () => {
    fetchMock = mockFetch(
      await prebuiltRoutes({ checkedAt: Date.now() - 4 * 24 * 60 * 60 * 1000 }),
    );

    await expect(prebuiltSource.fetchRelease()).rejects.toThrow('last built');
  });

  test('of another format is refused, without asking again', async () => {
    fetchMock = mockFetch(await prebuiltRoutes({ format: 2 }));

    await expect(fetchRelease(prebuiltSource, onRetry)).rejects.toThrow();
    expect(retries).toEqual([]);
  });

  test('is asked for once more, rather than three times, when the site fails', async () => {
    fetchMock = mockFetch({
      [prebuiltIndexURLs.metadata]: () =>
        new Response('Service Unavailable', { status: 503 }),
    });

    await expect(fetchRelease(prebuiltSource, onRetry)).rejects.toThrow('503');
    expect(retries).toEqual([[1, 1]]);
  });

  test("is asked for past the browser's cache", async () => {
    fetchMock = mockFetch(await prebuiltRoutes());

    await prebuiltSource.fetchRelease();

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-cache' });
  });
});
