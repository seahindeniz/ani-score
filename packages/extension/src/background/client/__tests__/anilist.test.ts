import { afterEach, beforeEach, expect, test } from 'bun:test';

import { useTokenStore } from '~/logic';

import { anilistURL, mockFetch } from '../../__tests__/network';
import { genreCollectionQuery } from '../../gql-queries/anilist';
import { anilistClient, isSignedOut } from '../anilist';

const tokenStore = useTokenStore();

let fetchMock: ReturnType<typeof mockFetch> | undefined;
let requests: Request[];

beforeEach(async () => {
  requests = [];
  await tokenStore.dataReady;
  tokenStore.setData({ anilist: 'secret-token' });
});

afterEach(() => {
  fetchMock?.mockRestore();
});

function answer(response: () => Response) {
  fetchMock = mockFetch({
    [anilistURL]: (request) => {
      requests.push(request);

      return response();
    },
  });
}

function queryGenres() {
  return anilistClient
    .query(genreCollectionQuery, {}, { requestPolicy: 'network-only' })
    .toPromise();
}

const invalidToken = () =>
  Response.json(
    { data: null, errors: [{ message: 'Invalid token', status: 400 }] },
    { status: 400 },
  );

test('sends queries to AniList with the stored token', async () => {
  answer(() => Response.json({ data: { GenreCollection: ['Action'] } }));

  const result = await queryGenres();

  expect(result.data?.GenreCollection).toEqual(['Action']);
  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe('POST');
  expect(requests[0].headers.get('authorization')).toBe('Bearer secret-token');
  // urql's own Accept header comes later in the spread and wins, but still includes JSON
  expect(requests[0].headers.get('accept')).toContain('application/json');
  expect(requests[0].headers.get('content-type')).toBe('application/json');
  expect(await requests[0].json()).toMatchObject({
    operationName: 'GenreCollection',
  });
});

test('sends nothing to AniList while signed out', async () => {
  tokenStore.setData({ anilist: '' });
  answer(() => Response.json({ data: { GenreCollection: ['Action'] } }));

  const result = await queryGenres();

  expect(isSignedOut(result.error)).toBe(true);
  expect(requests).toEqual([]);
});

test('forgets a token AniList rejects, and sends nothing until the user signs in again', async () => {
  answer(invalidToken);

  expect(isSignedOut((await queryGenres()).error)).toBe(true);
  expect(tokenStore.data().anilist).toBe('');

  await queryGenres();

  expect(requests).toHaveLength(1);

  tokenStore.setData({ anilist: 'new-token' });
  await queryGenres();

  expect(requests).toHaveLength(2);
  expect(requests[1].headers.get('authorization')).toBe('Bearer new-token');
});

test('keeps a token the user signed in with while a rejected request was on its way', async () => {
  answer(() => {
    tokenStore.setData({ anilist: 'new-token' });

    return invalidToken();
  });

  expect(isSignedOut((await queryGenres()).error)).toBe(true);
  expect(tokenStore.data().anilist).toBe('new-token');
});

test('keeps the token on other errors', async () => {
  answer(() =>
    Response.json(
      { data: null, errors: [{ message: 'Too Many Requests.', status: 429 }] },
      { status: 429 },
    ),
  );

  const result = await queryGenres();

  expect(result.error?.message).toContain('Too Many Requests.');
  expect(isSignedOut(result.error)).toBe(false);
  expect(tokenStore.data().anilist).toBe('secret-token');

  answer(() => new Response('Bad gateway', { status: 502 }));

  expect(isSignedOut((await queryGenres()).error)).toBe(false);
  expect(tokenStore.data().anilist).toBe('secret-token');
});
