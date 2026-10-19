import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import type { AnimeData } from '~/logic';
import { useAnimeDatabaseSearchCacheStore } from '~/logic';

import { fakeBrowser, resetFakeBrowser } from '../../../../test/fake-browser';
import {
  databaseEntries,
  databaseRoutes,
  databaseURLs,
  mockFetch,
  prebuiltRoutes,
} from '../../__tests__/network';
import { buildAnimeIndex, packAnimeIndex } from '../animeIndex';
import { prebuiltIndexURLs } from '../databaseSources';
import type { DatabaseInfo } from '../databaseStorage';
import {
  readDatabaseIndex,
  readDatabaseInfo,
  removeDatabaseIndex,
  writeDatabase,
} from '../databaseStorage';

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

function requested(url: string) {
  return fetchMock!.mock.calls.filter(([input]) => String(input) === url)
    .length;
}

/**
 * Stores the test database as if it was downloaded with this info.
 */
function storeDatabase(info: Partial<DatabaseInfo> = {}) {
  return writeDatabase(
    {
      lastUpdate: '2026-10-01',
      source: 'cedya77/anime-offline-database',
      checkedAt: 0,
      ...info,
    },
    buildAnimeIndex(databaseEntries).stored,
  );
}

/**
 * Holds a write transaction on the database store, so IndexedDB requests made meanwhile wait until it's released.
 */
async function holdStore() {
  const database = await new Promise<IDBDatabase>((resolve) => {
    indexedDB.open('anime-database', 1).onsuccess = function () {
      resolve(this.result);
    };
  });
  const store = database
    .transaction('database', 'readwrite')
    .objectStore('database');
  let held = true;
  const keepBusy = () => {
    if (held) store.get('info').onsuccess = keepBusy;
  };

  keepBusy();

  return () => {
    held = false;
    database.close();
  };
}

/**
 * Makes each IndexedDB write fail, as when the disk is full.
 */
function failWrites() {
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

    // Asked (the prebuilt index isn't published in this test), and found the stored database up to date
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      prebuiltIndexURLs.metadata,
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
    await storeDatabase({ source: 'athanasso/anime-offline-database' });
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect((await readDatabaseInfo())?.source).toBe(
      'cedya77/anime-offline-database',
    );
  });

  test('replaces data from an unknown source', async () => {
    await storeDatabase({ source: 'manami-project/anime-offline-database' });
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

  test('retries a response that broke off', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      ...databaseRoutes(),
      [databaseURLs.primaryLastUpdate]: () => {
        attempts++;

        // The connection drops after the first bytes
        return attempts === 1
          ? new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(
                    new TextEncoder().encode('{"lastUpdate": "2026-'),
                  );
                  controller.error(new TypeError('Connection reset'));
                },
              }),
            )
          : Response.json({ lastUpdate: '2026-10-01' });
      },
    });

    await loader.loadDatabase();

    expect(attempts).toBe(2);
    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test("doesn't retry a whole response that isn't JSON", async () => {
    fetchMock = mockFetch({
      // E.g. a captive portal's page
      [databaseURLs.primaryLastUpdate]: () =>
        new Response('<html>Sign in to the network</html>'),
    });

    await loader.loadDatabase();

    expect(requested(databaseURLs.primaryLastUpdate)).toBe(1);
  });

  test("doesn't retry metadata of an unexpected shape", async () => {
    fetchMock = mockFetch({
      // No `published_at`, so reading its date throws a TypeError
      [databaseURLs.fallbackLastUpdate]: { name: 'latest' },
    });

    await loader.loadDatabase();

    expect(requested(databaseURLs.fallbackLastUpdate)).toBe(1);
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
    failWrites();
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

    // Downloaded all the same, and kept in memory
    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test("doesn't ask the next source when the update check can't be stored", async () => {
    await storeDatabase();
    failWrites();
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(requested(databaseURLs.primaryLastUpdate)).toBe(1);
    expect(requested(databaseURLs.fallbackLastUpdate)).toBe(0);
    expect(downloads()).toEqual([]);
  });

  test('checks for updates when the last check seems to be in the future', async () => {
    // The clock was set back after the check
    await storeDatabase({ checkedAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(requested(databaseURLs.primaryLastUpdate)).toBe(1);
  });

  test('downloads the database again when its index is missing', async () => {
    await storeDatabase({ checkedAt: Date.now() });
    await removeDatabaseIndex();
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test("downloads the database again right away when the stored index can't be read", async () => {
    await writeDatabase(
      {
        lastUpdate: '2026-10-01',
        source: 'cedya77/anime-offline-database',
        checkedAt: Date.now(),
      },
      {
        entries: '[not json',
        terms: '',
        offsets: new ArrayBuffer(4),
        postings: new ArrayBuffer(0),
      },
    );
    fetchMock = mockFetch(databaseRoutes());
    await loader.loadDatabase();

    expect(downloads()).toEqual([]);
    // The search that found it unreadable waits for the new download
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(await readDatabaseIndex()).toBeDefined();
  });

  test("waits an hour to download a database again that couldn't be stored", async () => {
    failWrites();
    fetchMock = mockFetch(databaseRoutes());
    await loader.loadDatabase();

    await restart();
    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);

    clock += 2 * 60 * 60 * 1000;
    await restart();
    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary, databaseURLs.primary]);
  });

  test("also waits an hour when the replacement of a stored database couldn't be stored", async () => {
    await storeDatabase({ lastUpdate: '2026-09-01' });
    failWrites();
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));
    await loader.loadDatabase();

    await restart();
    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    // The older database is searched meanwhile
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test('downloads once when a download replaces an unreadable index meanwhile', async () => {
    const checking = Promise.withResolvers<void>();
    const answerCheck = Promise.withResolvers<void>();

    await writeDatabase(
      {
        lastUpdate: '2026-09-01',
        source: 'cedya77/anime-offline-database',
        checkedAt: 0,
      },
      {
        entries: '[not json',
        terms: '',
        offsets: new ArrayBuffer(4),
        postings: new ArrayBuffer(0),
      },
    );
    fetchMock = mockFetch({
      ...databaseRoutes({ lastUpdate: '2026-10-01' }),
      [databaseURLs.primaryLastUpdate]: async () => {
        checking.resolve();
        await answerCheck.promise;

        return Response.json({ lastUpdate: '2026-10-01' });
      },
    });

    const update = loader.loadDatabase();

    await checking.promise;

    // Finds the index unreadable while the update, which will replace it, checks for one
    const search = loader.searchAnimeByTitle('Sousou no Frieren');

    answerCheck.resolve();

    expect(await search).toMatchObject({ title: 'Sousou no Frieren' });
    await update;
    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(await readDatabaseIndex()).toBeDefined();
  });

  test('leaves a sign-in badge that was set during the download', async () => {
    fetchMock = mockFetch({
      ...databaseRoutes(),
      [databaseURLs.primary]: async () => {
        // Signed out meanwhile
        await fakeBrowser.action.setBadgeText({ text: 'Login' });

        return Response.json({ data: databaseEntries });
      },
    });

    await loader.loadDatabase();
    await new Promise((resolve) => realSetTimeout(resolve, 10));

    expect(fakeBrowser.action.setBadgeText.mock.calls.at(-1)).toEqual([
      { text: 'Login' },
    ]);
    expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalledWith(
      { color: '#00ff00' },
    );
  });

  test('still downloads when the database earlier versions kept cannot be removed', async () => {
    fakeBrowser.storage.local.remove.mockRejectedValueOnce(new Error('busy'));
    fetchMock = mockFetch(databaseRoutes());

    await loader.loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test('a search made before the update starts waits for it when nothing is stored', async () => {
    // The update starts after the sign-in check, which `engage` passes
    const signInCheck = Promise.withResolvers<void>();

    fetchMock = mockFetch(databaseRoutes());

    const update = loader.loadDatabase(signInCheck.promise);
    const search = loader.searchAnimeByTitle('Sousou no Frieren');

    // Long enough for the search to find nothing stored and wait for the update
    realSetTimeout(signInCheck.resolve, 50);

    expect(await search).toMatchObject({ title: 'Sousou no Frieren' });
    await update;
  });
});

describe('prebuilt index', () => {
  test('is downloaded rather than the upstream database', async () => {
    const prebuilt = await prebuiltRoutes();

    fetchMock = mockFetch({ ...prebuilt.routes, ...databaseRoutes() });

    await loader.loadDatabase();

    expect(requested(prebuilt.indexURL)).toBe(1);
    expect(downloads()).toEqual([]);
    // Stored as data of the source it was built from
    expect(await readDatabaseInfo()).toMatchObject({
      lastUpdate: '2026-10-01',
      source: 'cedya77/anime-offline-database',
    });
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test("doesn't replace the same data downloaded from its source", async () => {
    const prebuilt = await prebuiltRoutes({ lastUpdate: '2026-10-01' });

    await storeDatabase({ lastUpdate: '2026-10-01' });
    fetchMock = mockFetch({ ...prebuilt.routes, ...databaseRoutes() });

    await loader.loadDatabase();

    expect(requested(prebuilt.indexURL)).toBe(0);
    expect(requested(databaseURLs.primaryLastUpdate)).toBe(0);
  });

  test('replaces older data with newer', async () => {
    const prebuilt = await prebuiltRoutes({ lastUpdate: '2026-10-08' });

    await storeDatabase({ lastUpdate: '2026-10-01' });
    fetchMock = mockFetch(prebuilt.routes);

    await loader.loadDatabase();

    expect(requested(prebuilt.indexURL)).toBe(1);
    expect((await readDatabaseInfo())?.lastUpdate).toBe('2026-10-08');
  });

  test('is also read when served decompressed', async () => {
    const prebuilt = await prebuiltRoutes({ serve: (file) => file });

    fetchMock = mockFetch(prebuilt.routes);

    await loader.loadDatabase();

    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test("is skipped for the upstream source when it doesn't match its SHA-256", async () => {
    // A well-formed index, but not the one the metadata describes, as a cache could still hold an older one
    const prebuilt = await prebuiltRoutes({
      serve: () =>
        Bun.gzipSync(
          packAnimeIndex(buildAnimeIndex([databaseEntries[0]]).stored),
        ),
    });

    fetchMock = mockFetch({ ...prebuilt.routes, ...databaseRoutes() });

    await loader.loadDatabase();

    expect(requested(prebuilt.indexURL)).toBe(1);
    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test('is skipped for the upstream source once the site stopped building it', async () => {
    const prebuilt = await prebuiltRoutes({
      checkedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    });

    fetchMock = mockFetch({ ...prebuilt.routes, ...databaseRoutes() });

    await loader.loadDatabase();

    expect(requested(prebuilt.indexURL)).toBe(0);
    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test('is asked once more, rather than three times, when the site fails', async () => {
    fetchMock = mockFetch({
      ...databaseRoutes(),
      [prebuiltIndexURLs.metadata]: () =>
        new Response('Service Unavailable', { status: 503 }),
    });

    await loader.loadDatabase();

    expect(requested(prebuiltIndexURLs.metadata)).toBe(2);
    expect(downloads()).toEqual([databaseURLs.primary]);
  });

  test("is asked for past the browser's cache", async () => {
    const prebuilt = await prebuiltRoutes();

    fetchMock = mockFetch(prebuilt.routes);

    await loader.loadDatabase();

    expect(
      fetchMock.mock.calls.find(
        ([input]) => String(input) === prebuiltIndexURLs.metadata,
      )?.[1],
    ).toMatchObject({ cache: 'no-cache' });
  });

  test('of another format is skipped for the upstream source, without retrying', async () => {
    const prebuilt = await prebuiltRoutes({ format: 2 });

    fetchMock = mockFetch({ ...prebuilt.routes, ...databaseRoutes() });

    await loader.loadDatabase();

    expect(requested(prebuiltIndexURLs.metadata)).toBe(1);
    expect(downloads()).toEqual([databaseURLs.primary]);
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

  test('searches the stored database while the update check runs', async () => {
    const check = Promise.withResolvers<void>();

    routesAgain({
      ...databaseRoutes(),
      [databaseURLs.primaryLastUpdate]: async () => {
        await check.promise;

        return Response.json({ lastUpdate: '2026-10-01' });
      },
    });
    aDayLater();
    await restart();

    const update = loader.loadDatabase();

    // Answered while the check waits for GitHub
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });

    check.resolve();
    await update;
  });

  test('searches the stored database while a download runs, and the new one after', async () => {
    const newAnime = {
      title: 'Brand New Anime',
      type: 'TV',
      sources: ['https://anilist.co/anime/3'],
      synonyms: [],
    } as unknown as AnimeData;
    const downloadStarted = Promise.withResolvers<void>();
    const finishDownload = Promise.withResolvers<void>();

    routesAgain({
      ...databaseRoutes({ lastUpdate: '2026-10-08' }),
      [databaseURLs.primary]: async () => {
        downloadStarted.resolve();
        await finishDownload.promise;

        return Response.json({ data: [...databaseEntries, newAnime] });
      },
    });
    aDayLater();
    await restart();

    const update = loader.loadDatabase();

    await downloadStarted.promise;

    // Answered while the download stalls
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
    expect(await loader.searchAnimeByTitle('Brand New Anime')).toBeUndefined();

    finishDownload.resolve();
    await update;

    expect(await loader.searchAnimeByTitle('Brand New Anime')).toMatchObject({
      title: 'Brand New Anime',
    });
  });

  test("doesn't cache a match from an index that a download replaced meanwhile", async () => {
    const checking = Promise.withResolvers<void>();
    const answerCheck = Promise.withResolvers<void>();

    routesAgain({
      ...databaseRoutes(),
      [databaseURLs.primaryLastUpdate]: async () => {
        checking.resolve();
        await answerCheck.promise;

        return Response.json({ lastUpdate: '2026-10-08' });
      },
    });
    aDayLater();
    await restart();
    searchCacheStore.setData({ 'Some Title': cachedMatch });

    const update = loader.loadDatabase();

    await checking.promise;

    // The search reads the stored index, slowly, while the download replaces it
    const releaseStore = await holdStore();
    const search = loader.searchAnimeByTitle('The Apothecary Diaries Season 3');

    answerCheck.resolve();

    while ('Some Title' in searchCacheStore.data()) {
      await new Promise((resolve) => realSetTimeout(resolve, 5));
    }

    releaseStore();

    expect(await search).toMatchObject({
      title: 'Kusuriya no Hitorigoto 3rd Season',
    });
    await update;
    expect(searchCacheStore.data()).toEqual({});
  });

  test('reads the stored database again after a failed read', async () => {
    const get = IDBObjectStore.prototype.get;
    let failures = 0;

    spies.push(
      spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
        this: IDBObjectStore,
        key: IDBValidKey | IDBKeyRange,
      ) {
        // Both reads of the first search: before and after waiting for the update
        if (key === 'index' && failures++ < 2) {
          throw new DOMException('Read failed', 'UnknownError');
        }

        return get.call(this, key);
      }),
    );
    await restart();
    await loader.loadDatabase();

    expect(
      await loader.searchAnimeByTitle('Sousou no Frieren'),
    ).toBeUndefined();
    expect(await loader.searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
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
