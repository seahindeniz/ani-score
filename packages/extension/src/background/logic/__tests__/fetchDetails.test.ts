import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';

import { parse } from 'graphql';

import { useTokenStore } from '~/logic';

import { fakeBrowser } from '../../../../test/fake-browser';
import {
  anilistHandler,
  anilistURL,
  databaseRoutes,
  mockFetch,
  parseLookups,
} from '../../__tests__/network';
import { anilistClient } from '../../client/anilist';
import { detailsTtl, forgetDetails } from '../detailsCache';
import type { AnimeDetails } from '../fetchDetails';
import { fetchDetails } from '../fetchDetails';
import { loadDatabase, searchAnimeByTitle } from '../loadDatabase';

// Partial AniList responses: the mock returns them as they are
const frieren = {
  id: 154587,
  isFavourite: false,
  title: { userPreferred: 'Frieren' },
  favourites: 1234,
} as AnimeDetails;
const apothecarySeason3 = {
  id: 190001,
  idMal: 60000,
  isFavourite: false,
  title: { userPreferred: 'The Apothecary Diaries Season 3' },
} as AnimeDetails & { idMal: number };

const tokenStore = useTokenStore();

let fetchMock: ReturnType<typeof mockFetch> | undefined;
let requests: Parameters<typeof anilistHandler>[1] & object;

beforeAll(async () => {
  fetchMock = mockFetch(databaseRoutes());
  await loadDatabase();
  fetchMock.mockRestore();
});

beforeEach(async () => {
  // Each test asks AniList anew
  forgetDetails(() => true);
  requests = [];
  fetchMock = mockFetch({
    [anilistURL]: anilistHandler([frieren, apothecarySeason3], requests),
  });
  await tokenStore.dataReady;
  tokenStore.setData({ anilist: 'token' });
});

afterEach(() => {
  fetchMock?.mockRestore();
});

// How AniList answers with an error: a non-2xx status with GraphQL `errors`
function anilistError(message: string, status: number) {
  return Response.json(
    { errors: [{ message, status }], data: null },
    { status },
  );
}

function answerAniList(handler: Parameters<typeof mockFetch>[0][string]) {
  fetchMock?.mockRestore();
  fetchMock = mockFetch({ [anilistURL]: handler });
}

describe('fetchDetails', () => {
  test('skips AniList when there are no cards', async () => {
    expect(await fetchDetails({ cards: [] })).toBeUndefined();
    expect(requests).toEqual([]);
  });

  test('looks titles up by the IDs the database knows, and by search otherwise', async () => {
    const details = await fetchDetails({
      cards: [
        { title: 'Sousou no Frieren', episodeNumber: 1 },
        { title: 'Sousou no Frieren', episodeNumber: 2 },
        { title: 'The Apothecary Diaries Season 3', episodeNumber: 3 },
        { title: 'Unknown Show', episodeNumber: 1 },
      ],
    });

    expect(details).toEqual({
      'Sousou no Frieren': frieren,
      'The Apothecary Diaries Season 3': apothecarySeason3,
      'Unknown Show': null,
    });
    expect(requests).toHaveLength(1);
    expect(parseLookups(requests[0].query)).toEqual([
      { alias: 'a_1_sousou_no_frieren', by: 'id', value: '154587' },
      {
        alias: 'a_2_the_apothecary_diaries_season_3',
        by: 'idMal',
        value: '60000',
      },
      { alias: 'a_3_unknown_show', by: 'search', value: '"Unknown Show"' },
    ]);
  });

  test('sends search titles to AniList as GraphQL strings', async () => {
    const title = 'A "Quoted" \\ Title';

    await fetchDetails({ cards: [{ title, episodeNumber: 1 }] });

    const [operation] = parse(requests[0].query).definitions as any[];
    const [, search] =
      operation.selectionSet.selections[0].selectionSet.selections[0].arguments;

    expect(operation.selectionSet.selections[0].alias.value).toBe(
      'a_1_a_quoted_title',
    );
    expect(search.value.value).toBe(title);
  });

  test('splits many titles into batches of five', async () => {
    const titles = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

    const details = await fetchDetails({
      cards: titles.map((title) => ({ title, episodeNumber: 1 })),
    });

    expect(
      requests.map(({ query }) => query.match(/query (\w+)/)?.[1]),
    ).toEqual(['BatchAnimeSearch0', 'BatchAnimeSearch1']);
    expect(requests.map(({ query }) => parseLookups(query).length)).toEqual([
      5, 1,
    ]);
    expect(Object.keys(details!)).toEqual(titles);
  });

  test('signs out when AniList rejects the token, and opens one sign-in tab', async () => {
    answerAniList(async (request) => {
      requests.push({ ...(await request.json()), headers: request.headers });

      return anilistError('Invalid token', 400);
    });

    const titles = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const fetches = [titles, ['Seven']].map((list) =>
      fetchDetails({
        cards: list.map((title) => ({ title, episodeNumber: 1 })),
      }),
    );

    expect(await Promise.all(fetches)).toEqual([undefined, undefined]);
    expect(tokenStore.data().anilist).toBe('');
    // The six titles' second batch waits for the first one, which AniList rejected
    expect(
      requests.map(({ query }) => query.match(/query (\w+)/)?.[1]),
    ).not.toContain('BatchAnimeSearch1');
    expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(1);
    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({
      url: 'https://anilist.co/api/v2/oauth/authorize?client_id=test',
    });
    expect(fakeBrowser.notifications.create).toHaveBeenCalledTimes(1);
  });

  test('asks nothing of AniList while signed out, and opens the sign-in once its tab is closed', async () => {
    tokenStore.setData({ anilist: '' });

    const cards = [{ title: 'Sousou no Frieren', episodeNumber: 1 }];

    expect(await fetchDetails({ cards })).toBeUndefined();
    expect(await fetchDetails({ cards })).toBeUndefined();
    expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(1);

    await fakeBrowser.tabs.remove(1);
    await fetchDetails({ cards });

    expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(2);
    expect(requests).toEqual([]);
  });

  test('keeps the token on other AniList errors', async () => {
    answerAniList(() => anilistError('Too Many Requests.', 429));

    expect(
      await fetchDetails({
        cards: [{ title: 'Sousou no Frieren', episodeNumber: 1 }],
      }),
    ).toEqual({
      'Sousou no Frieren': null,
    });
    expect(tokenStore.data().anilist).toBe('token');
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
    expect(fakeBrowser.notifications.create).not.toHaveBeenCalled();
  });

  test('keeps the batches that succeeded when another one fails', async () => {
    const succeed = anilistHandler([frieren], requests);

    answerAniList((request) =>
      requests.length
        ? anilistError('Too Many Requests.', 429)
        : succeed(request),
    );

    const details = await fetchDetails({
      cards: ['Sousou no Frieren', 'Two', 'Three', 'Four', 'Five', 'Six'].map(
        (title) => ({ title, episodeNumber: 1 }),
      ),
    });

    expect(details?.['Sousou no Frieren']).toEqual(frieren);
    expect(details?.Six).toBeNull();

    // The failed batch is asked for again, the other one isn't
    requests = [];
    answerAniList(anilistHandler([frieren], requests));
    await fetchDetails({
      cards: ['Sousou no Frieren', 'Six'].map((title) => ({
        title,
        episodeNumber: 1,
      })),
    });

    expect(parseLookups(requests[0].query)).toEqual([
      { alias: 'a_1_six', by: 'search', value: '"Six"' },
    ]);
  });

  test('keeps the details for 15 minutes, or as long as asked', async () => {
    const cards = [{ title: 'Sousou no Frieren', episodeNumber: 1 }];
    const now = spyOn(Date, 'now');

    now.mockReturnValue(0);
    await fetchDetails({ cards });
    now.mockReturnValue(detailsTtl - 1);

    expect(await fetchDetails({ cards })).toEqual({
      'Sousou no Frieren': frieren,
    });
    expect(requests).toHaveLength(1);

    await fetchDetails({ cards, maxAge: 0 });

    expect(requests).toHaveLength(2);

    // Kept since then: half a minute old is young enough, a minute and a half isn't
    now.mockReturnValue(detailsTtl - 1 + 30_000);
    await fetchDetails({ cards, maxAge: 60_000 });

    expect(requests).toHaveLength(2);

    now.mockReturnValue(detailsTtl - 1 + 90_000);
    await fetchDetails({ cards, maxAge: 60_000 });

    expect(requests).toHaveLength(3);

    now.mockReturnValue(3 * detailsTtl);
    await fetchDetails({ cards });

    expect(requests).toHaveLength(4);

    now.mockRestore();
  });

  test('handles a request that rejects while later batches are still waiting', async () => {
    const query = spyOn(anilistClient, 'query').mockReturnValue({
      toPromise: () => Promise.reject(new Error('offline')),
    } as any);

    const details = await fetchDetails({
      cards: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((title) => ({
        title,
        episodeNumber: 1,
      })),
    });

    expect(details).toEqual(
      Object.fromEntries(
        ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((title) => [
          title,
          null,
        ]),
      ),
    );
    expect(tokenStore.data().anilist).toBe('token');

    query.mockRestore();
  });

  test('returns nothing when building the queries fails', async () => {
    const query = spyOn(anilistClient, 'query').mockImplementation(() => {
      throw new Error('broken client');
    });

    expect(
      await fetchDetails({
        cards: [{ title: 'Sousou no Frieren', episodeNumber: 1 }],
      }),
    ).toBeUndefined();

    query.mockRestore();
  });

  test("leaves the database entry's sources in their order", async () => {
    await fetchDetails({
      cards: [{ title: 'Kusuriya no Hitorigoto', episodeNumber: 1 }],
    });

    // Sorting them by ID in place would reorder the entry the index and the search cache share
    expect(
      (await searchAnimeByTitle('Kusuriya no Hitorigoto'))?.sources,
    ).toEqual([
      'https://anilist.co/anime/161645',
      'https://myanimelist.net/anime/54492',
    ]);
  });
});
