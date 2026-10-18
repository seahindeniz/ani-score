import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import {
  useAnimeDatabaseSearchCacheStore,
  useAnimeDatabaseStore,
} from '~/logic';

import { fakeBrowser, resetFakeBrowser } from '../../../../test/fake-browser';
import {
  databaseEntries,
  databaseRoutes,
  databaseURLs,
  mockFetch,
} from '../../__tests__/network';
import { loadDatabase, searchAnimeByTitle } from '../loadDatabase';

const realSetTimeout = globalThis.setTimeout;
const databaseStore = useAnimeDatabaseStore();
const searchCacheStore = useAnimeDatabaseSearchCacheStore();

let fetchMock: ReturnType<typeof mockFetch> | undefined;

function downloads() {
  return fetchMock!.mock.calls
    .map(([input]) => String(input))
    .filter(
      (url) => url === databaseURLs.primary || url === databaseURLs.fallback,
    );
}

beforeEach(async () => {
  // Timers left by the previous test (e.g. the badge reset) would otherwise land in this one
  await new Promise((resolve) => realSetTimeout(resolve, 10));
  resetFakeBrowser();

  // Retries and the badge reset wait for seconds; run them right away
  spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) =>
    realSetTimeout(callback, 0)) as typeof setTimeout);

  await databaseStore.dataReady;
  await searchCacheStore.dataReady;
  databaseStore.setData({ lastUpdate: '', source: '', data: '' });
  searchCacheStore.setData({});
});

afterEach(() => {
  fetchMock?.mockRestore();
  fetchMock = undefined;
  (globalThis.setTimeout as unknown as ReturnType<typeof spyOn>).mockRestore();
});

describe('loadDatabase', () => {
  test('downloads the preferred database when none is stored', async () => {
    fetchMock = mockFetch(databaseRoutes());

    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(databaseStore.data()).toMatchObject({
      lastUpdate: '2026-10-01',
      source: 'cedya77/anime-offline-database',
    });
    expect(searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
      type: 'TV',
    });
    // Entries without an AniList or MyAnimeList source are dropped
    expect(searchAnimeByTitle('Kitsu Only Anime')).toBeUndefined();
  });

  test('shows a loading badge, then a green one that clears itself', async () => {
    fetchMock = mockFetch(databaseRoutes());

    await loadDatabase();
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

    await loadDatabase();

    expect(fakeBrowser.action.setBadgeText).not.toHaveBeenCalled();
    expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  test('keeps a stored database that is up to date', async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loadDatabase();
    searchCacheStore.setData({
      'Some Title': {
        id: 'cached',
        title: 'Some Title',
        type: 'TV',
        sources: [],
        synonyms: [],
      },
    });

    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
    expect(searchCacheStore.data()).toHaveProperty('Some Title');
  });

  test('replaces the stored database once a newer one is published', async () => {
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-09-01' }));
    await loadDatabase();
    searchCacheStore.setData({
      'Some Title': {
        id: 'cached',
        title: 'Some Title',
        type: 'TV',
        sources: [],
        synonyms: [],
      },
    });
    fetchMock.mockRestore();

    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));
    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(databaseStore.data().lastUpdate).toBe('2026-10-01');
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

    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.fallback]);
    expect(databaseStore.data()).toMatchObject({
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
    databaseStore.setData({
      lastUpdate: '2026-10-01',
      source: 'athanasso/anime-offline-database',
      data: '',
    });
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));

    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.primary]);
    expect(databaseStore.data().source).toBe('cedya77/anime-offline-database');
  });

  test('replaces data from an unknown source', async () => {
    databaseStore.setData({
      lastUpdate: '2026-10-01',
      source: 'manami-project/anime-offline-database',
      data: '',
    });
    fetchMock = mockFetch(databaseRoutes({ lastUpdate: '2026-10-01' }));

    await loadDatabase();

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

    await loadDatabase();

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

    await loadDatabase();

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

    await loadDatabase();

    expect(downloads()).toEqual([databaseURLs.fallback]);
  });

  test('loads the stored database when no source answers', async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loadDatabase();
    fetchMock.mockRestore();

    fetchMock = mockFetch({});
    await loadDatabase();

    expect(downloads()).toEqual([]);
    expect(searchAnimeByTitle('Sousou no Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
    });
  });

  test('survives having neither a source nor a stored database', async () => {
    fetchMock = mockFetch({});

    expect(await loadDatabase()).toBeUndefined();
  });
});

describe('searchAnimeByTitle', () => {
  beforeEach(async () => {
    fetchMock = mockFetch(databaseRoutes());
    await loadDatabase();
  });

  test('returns a cached match without searching', () => {
    const cached = {
      id: 'cached',
      title: 'Something Else',
      type: 'OVA' as const,
      sources: [],
      synonyms: [],
    };

    searchCacheStore.setData({ 'Sousou no Frieren': cached });

    expect(searchAnimeByTitle('Sousou no Frieren')).toEqual(cached);
  });

  test('returns nothing for an unknown title', () => {
    expect(searchAnimeByTitle('Completely Unknown')).toBeUndefined();
  });

  test('returns the only entry the index finds', () => {
    expect(searchAnimeByTitle('Frieren')).toMatchObject({
      title: 'Sousou no Frieren',
      sources: databaseEntries[0].sources,
      synonyms: databaseEntries[0].synonyms,
    });
    expect(searchCacheStore.data()).toEqual({});
  });

  test('picks the closest of several entries and caches it', () => {
    const match = searchAnimeByTitle('The Apothecary Diaries Season 3');

    expect(match).toMatchObject({ title: 'Kusuriya no Hitorigoto 3rd Season' });
    expect(searchCacheStore.data()['The Apothecary Diaries Season 3']).toEqual(
      match!,
    );
  });

  test('prefers the TV entry when matches score the same', () => {
    expect(searchAnimeByTitle('Twin Title')).toMatchObject({
      title: 'Twin Title',
      type: 'TV',
    });
  });

  test("returns nothing when the index matches but the title doesn't", () => {
    expect(searchAnimeByTitle('Kusuriya zzqq')).toBeUndefined();
  });
});
