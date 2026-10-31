import { afterEach, beforeEach, expect, test } from 'bun:test';

import { useTokenStore } from '~/logic';
import { wait } from '~/utils/wait';

import { fakeBrowser } from '../../../../test/fake-browser';
import { anilistURL, mockFetch } from '../../__tests__/network';
import { cacheDetails, readCachedDetails, watchAccount } from '../detailsCache';
import type { AnimeDetails } from '../fetchDetails';
import { makeAnimeFavorite } from '../makeAnimeFavorite';

let fetchMock: ReturnType<typeof mockFetch> | undefined;

beforeEach(async () => {
  const tokenStore = useTokenStore();

  await tokenStore.dataReady;
  tokenStore.setData({ anilist: 'token' });
});

afterEach(() => {
  fetchMock?.mockRestore();
});

test('toggles the anime as a favorite on AniList', async () => {
  const bodies: { query: string; variables: Record<string, unknown> }[] = [];

  fetchMock = mockFetch({
    [anilistURL]: async (request) => {
      bodies.push((await request.json()) as (typeof bodies)[number]);

      return Response.json({
        data: { ToggleFavourite: { anime: { pageInfo: { total: 1 } } } },
      });
    },
  });

  const result = await makeAnimeFavorite(154587);

  expect(result.error).toBeUndefined();
  expect(result.data?.ToggleFavourite?.anime?.pageInfo?.total).toBe(1);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].query).toContain('ToggleFavourite');
  expect(bodies[0].variables).toEqual({ animeId: 154587 });
});

test('drops what the extension kept for the anime, but not when AniList refused', async () => {
  const kept = (id: number) => ({ id }) as AnimeDetails;
  let fail = true;

  fetchMock = mockFetch({
    [anilistURL]: () =>
      fail
        ? Response.json({ errors: [{ message: 'Unauthorized', status: 401 }] })
        : Response.json({
            data: { ToggleFavourite: { anime: { pageInfo: { total: 1 } } } },
          }),
  });
  cacheDetails({ Frieren: kept(154587), Dandadan: kept(171018) });

  await makeAnimeFavorite(154587);

  expect(readCachedDetails(['Frieren']).missing).toEqual([]);

  fail = false;
  await makeAnimeFavorite(154587);

  expect(readCachedDetails(['Frieren', 'Dandadan'])).toEqual({
    found: { Dandadan: kept(171018) },
    missing: ['Frieren'],
  });
});

test("forgets everything kept once the user signs in, out or as someone else, since it's theirs", async () => {
  // Storage changes still pending from the other tests
  await wait(10);
  watchAccount();
  await fakeBrowser.storage.local.set({ token: { anilist: '' } });
  await wait(0);
  cacheDetails({ Frieren: { id: 1 } as AnimeDetails });

  // Other settings, and writing the same token again, don't matter
  await fakeBrowser.storage.local.set({ theme: 'dark' });
  await fakeBrowser.storage.local.set({ token: { anilist: '' } });
  fakeBrowser.storage.onChanged.dispatch({ token: {} }, 'sync');
  await wait(0);

  expect(readCachedDetails(['Frieren']).missing).toEqual([]);

  await fakeBrowser.storage.local.set({ token: { anilist: 'other' } });
  await wait(0);

  expect(readCachedDetails(['Frieren']).missing).toEqual(['Frieren']);
});
