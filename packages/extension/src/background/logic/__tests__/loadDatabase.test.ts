import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import type { AnimeData } from '~/logic';
import { useAnimeDatabaseSearchCacheStore } from '~/logic';

import { fakeBrowser, resetFakeBrowser } from '../../../../test/fake-browser';
import {
  databaseEntries,
  databaseRoutes,
  databaseURLs,
  mockFetch,
} from '../../__tests__/network';
import { readDatabaseInfo, writeDatabaseInfo } from '../databaseStorage';

const realSetTimeout = globalThis.setTimeout;
const realNow = Date.now;
const searchCacheStore = useAnimeDatabaseSearchCacheStore();

let fetchMock: ReturnType<typeof mockFetch> | undefined;
let spies: ReturnType<typeof spyOn>[] = [];
let loader: typeof import('../loadDatabase');
let restarts = 0;
let clock = 0;

/**
 * A new copy of the module, as after the background restarts: what it kept in memory is gone, the stores and
 * IndexedDB are kept.
 */
async function restart() {
  restarts++;
  loader = await import(`../loadDatabase.ts?restart=${restarts}`);
}

function aDayLater() {
  clock += 25 * 60 * 60 * 1000;
}

function downloads() {
  return fetchMock!.mock.calls
    .map(([input]) => String(input))
    .filter(
      (url) => url === databaseURLs.primary || url === databaseURLs.fallback,
    );
}

function routesAgain(routes: Parameters<typeof mockFetch>[0]) {
  fetchMock?.mockRestore();
  fetchMock = mockFetch(routes);
}

const cachedMatch = {
  title: 'Some Title',
  type: 'TV' as const,
  sources: [],
  synonyms: [],
};

beforeEach(async () => {
  // Timers left by the previous test (e.g. the badge reset) would otherwise land in this one
  await new Promise((resolve) => realSetTimeout(resolve, 10));
  resetFakeBrowser();

  clock = 0;
  spies = [
    // Retries and the badge reset wait for seconds; run them right away
    spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: () => void,
    ) => realSetTimeout(callback, 0)) as typeof setTimeout),
    spyOn(Date, 'now').mockImplementation(() => realNow() + clock),
  ];

  await searchCacheStore.dataReady;
  searchCacheStore.setData({});
  await restart();
});

afterEach(() => {
  fetchMock?.mockRestore();
  fetchMock = undefined;
  spies.forEach((spy) => spy.mockRestore());
});

describe('loadDatabase', () => {
  test('downloads the preferred database when none is stored', async () => {
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(await readDatabaseInfo()).toMatchObject({
      lastUpdate: '2026-10-01',
      source: 'cedya77/anime-offline-database',
    });
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
      type: 'TV',
    });
    // Entries without an AniList or MyAnimeList source are dropped
    expect(await loader.searchAnimeByTitle('Kitsu Only Anime')).toBeUndefined();
  });

  test('shows a loading badge, then a green one that clears itself', async () => {
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();
    await new Promise((resolve) => realSetTimeout(resolve, 10));

    expect(fakeBrowser.action.setBadgeText.mock.calls).toEqual([
      [{ text: ' ' }],
      [{ text: '' }],
    ]);
    expect(fakeBrowser.action.setBadgeBackgroundColor.mock.calls).toEqual([
      [{ color: '#ffd000ff' }],
      [{ color: '#00ff00' }],
    ]);
  });

  test('leaves a badge that is already shown alone', async () => {
    fetchMock = mockFetch(databaseRoutes());
    await fakeBrowser.action.setBadgeText({ text: 'Login' });
    fakeBrowser.action.setBadgeText.mockClear();

    await loader.loadDatabase();

    expect(fakeBrowser.action.setBadgeText).not.toHaveBeenCalled();
    expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  test('clears the loading badge when the download fails', async () => {
    fetchMock = mockFetch({
      [databaseURLs.primaryLastUpdate]: { lastUpdate: '2026-10-01' },
    });

    await loader.loadDatabase();

    expect(fakeBrowser.action.setBadgeText.mock.calls).toEqual([
      [{ text: ' ' }],
      [{ text: '' }],
    ]);
    expect(await readDatabaseInfo()).toBeUndefined();
  });

  test('checks for updates at most once a day', async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loader.loadDatabase();
    searchCacheStore.setData({ 'Some Title': cachedMatch });
    routesAgain(databaseRoutes());

    await restart();
    await loader.loadDatabase();

    expect(fetchMock.mock.calls).toEqual([]);

    aDayLater();
    await restart();
    await loader.loadDatabase();

    // Asked, and found the stored database up to date
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      databaseURLs.primaryLastUpdate,
    ]);
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
    expect(searchCacheStore.data()).toHaveProperty('Some Title');

    // The check counts from the last one
    routesAgain(databaseRoutes());
    await restart();
    await loader.loadDatabase();

    expect(fetchMock.mock.calls).toEqual([]);
  });

  test('replaces the stored database once a newer one is published', async () => {
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-09-01' }));
    await loader.loadDatabase();
    searchCacheStore.setData({ 'Some Title': cachedMatch });

    routesAgain(databaseRoutes({ lastUpdate: '2026-10-01' }));
    aDayLater();
    await restart();
    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect((await readDatabaseInfo())?.lastUpdate).toBe('2026-10-01');
    // Cached matches pointed at entries of the replaced database
    expect(searchCacheStore.data()).toEqual({});
  });

  test('falls back to the next source when the preferred one is missing', async () => {
    fetchMock = mockFetch({
      [databaseURLs.fallbackLastUpdate]: {
        published_at: '2026-10-02T12:00:00Z',
      },
      [databaseURLs.fallback]: { data: databaseEntries },
    });

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.fallback]);
    expect(await readDatabaseInfo()).toMatchObject({
      lastUpdate: '2026-10-02',
      source: 'athanasso/anime-offline-database',
    });
    // A missing file won't appear by retrying
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === databaseURLs.primaryLastUpdate,
      ),
    ).toHaveLength(1);
  });

  test('switches back to the preferred source once it answers again', async () => {
    await writeDatabaseInfo({
      lastUpdate: '2026-10-01',
      source: 'athanasso/anime-offline-database',
      checkedAt: 0,
    });
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect((await readDatabaseInfo())?.source).toBe(
      'cedya77/anime-offline-database',
    );
  });

  test('replaces data from an unknown source', async () => {
    await writeDatabaseInfo({
      lastUpdate: '2026-10-01',
      source: 'manami-project/anime-offline-database',
      checkedAt: 0,
    });
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test('retries a failing update check', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      ...databaseRoutes(),
      [databaseURLs.primaryLastUpdate]: () => {
        attempts++;

        if (attempts === 1) throw new TypeError('Failed to fetch');

        return Response.json({ lastUpdate: '2026-10-01' });
      },
    });

    await loader.loadDatabase();

    expect(attempts).toBe(2);
    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test('gives up on a source after three retries', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      [databaseURLs.primaryLastUpdate]: () => {
        attempts++;

        return new Response('Server Error', { status: 500 });
      },
      [databaseURLs.fallbackLastUpdate]: {
        published_at: '2026-10-01T00:00:00Z',
      },
      [databaseURLs.fallback]: { data: databaseEntries },
    });

    await loader.loadDatabase();

    expect(attempts).toBe(4);
    expect(downloads()).toEqual([databaseURLs.fallback]);
  });

  test("rejects an update date it can't parse", async () => {
    fetchMock = mockFetch({
      [databaseURLs.primaryLastUpdate]: { lastUpdate: 'not a date' },
      [databaseURLs.fallbackLastUpdate]: {
        published_at: '2026-10-01T00:00:00Z',
      },
      [databaseURLs.fallback]: { data: databaseEntries },
    });

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.fallback]);
  });

  test('keeps the stored database when no source answers', async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loader.loadDatabase();

    routesAgain({});
    aDayLater();
    await restart();
    await loader.loadDatabase();

    expect(downloads()).toEqual([]);
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test('survives having neither a source nor a stored database', async () => {
    fetchMock = mockFetch({});

    expect(await loader.loadDatabase()).toBeUndefined();
    expect(
      await loader.searchAnimeByTitle('Sousou no Frieren'),
    ).toBeUndefined();
  });

  test('removes the database earlier versions kept in extension storage', async () => {
    await fakeBrowser.storage.local.set({
      animeDatabase: { lastUpdate: '2026-09-01', source: '', data: '{}' },
    });
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(await fakeBrowser.storage.local.get('animeDatabase')).toEqual({});
  });

  test("uses a database it couldn't store until the background restarts", async () => {
    const put = IDBObjectStore.prototype.put;

    spies.push(
      spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        const request = put.apply(this, args);

        this.transaction.abort();

        return request;
      }),
    );
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    // Not downloaded again from the next source
    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
    expect(await readDatabaseInfo()).toBeUndefined();
  });

  test("survives storage it can't open", async () => {
    // A newer version of the database, which can't be opened as the older one
    await new Promise((resolve) => {
      indexedDB.open('anime-database', 2).onsuccess = function () {
        this.result.close();
        resolve(undefined);
      };
    });
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(downloads()).toEqual([]);
    expect(
      await loader.searchAnimeByTitle('Sousou no Frieren'),
    ).toBeUndefined();
  });
});

describe('searchAnimeByTitle', () => {
  beforeEach(async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loader.loadDatabase();
  });

  test('reads the stored database on the first title that is not cached', async () => {
    const get = spyOn(IDBObjectStore.prototype, 'get');
    const indexReads = () =>
      get.mock.calls.filter(([key]) => key === 'index').length;

    spies.push(get);
    searchCacheStore.setData({ 'Some Title': cachedMatch });
    await restart();
    await loader.loadDatabase();

    expect(await loader.searchAnimeByTitle('Some Title')).toEqual(cachedMatch);
    expect(indexReads()).toBe(0);

    await loader.searchAnimeByTitle('Sousou no Frieren');
    await loader.searchAnimeByTitle('Kusuriya no Hitorigoto');

    expect(indexReads()).toBe(1);
  });

  test('waits for a running update rather than reading the database it replaces', async () => {
    const newAnime = {
      title: 'Brand New Anime',
      type: 'TV',
      sources: ['https://anilist.co/anime/3'],
      synonyms: [],
    } as unknown as AnimeData;

    routesAgain(
      databaseRoutes({
        lastUpdate: '2026-10-08',
        entries: [...databaseEntries, newAnime],
      }),
    );
    aDayLater();
    await restart();

    const update = loader.loadDatabase();

    expect(await loader.searchAnimeByTitle('Brand New Anime')).toMatchObject({
      title: 'Brand New Anime',
    });
    await update;
  });

  test('returns a cached match without searching', async () => {
    const cached = { ...cachedMatch, title: 'Something Else' };

    searchCacheStore.setData({ 'Sousou no Frieren': cached });

    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toEqual(
      cached,
    );
  });

  test('returns nothing for an unknown title', async () => {
    expect(
      await loader.searchAnimeByTitle('Completely Unknown'),
    ).toBeUndefined();
  });

  test('returns the only entry the index finds', async () => {
    expect(await loader.searchAnimeByTitle('Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
      sources: databaseEntries[0].sources,
      synonyms: databaseEntries[0].synonyms,
    });
    expect(searchCacheStore.data()).toEqual({});
  });

  test('picks the closest of several entries and caches it', async () => {
    const match = await loader.searchAnimeByTitle(
      'The Apothecary Diaries Season 3',
    );

    expect(match).toMatchObject({ title: 'Kusuriya no Hitorigoto 3rd Season' });
    expect(searchCacheStore.data()['The Apothecary Diaries Season 3']).toEqual(
      match!,
    );
  });

  test('prefers the TV entry when matches score the same', async () => {
    expect(await loader.searchAnimeByTitle('Twin Title')).toMatchObject({
      title: 'Twin Title',
      type: 'TV',
    });
  });

  test("returns nothing when the index matches but the title doesn't", async () => {
    expect(await loader.searchAnimeByTitle('Kusuriya zzqq')).toBeUndefined();
  });
});
