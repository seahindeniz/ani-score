import { afterEach, expect, test } from 'bun:test';

import { useTokenStore } from '~/logic';

import { anilistURL, mockFetch } from '../../__tests__/network';
import { genreCollectionQuery } from '../../gql-queries/anilist';
import { anilistClient } from '../anilist';

let fetchMock: ReturnType<typeof mockFetch> | undefined;

afterEach(() => {
  fetchMock?.mockRestore();
});

test('sends queries to AniList with the stored token', async () => {
  const requests: Request[] = [];
  const tokenStore = useTokenStore();

  await tokenStore.dataReady;
  tokenStore.setData({ anilist: 'secret-token' });
  fetchMock = mockFetch({
    [anilistURL]: (request) => {
      requests.push(request);

      return Response.json({ data: { GenreCollection: ['Action'] } });
    },
  });

  const result = await anilistClient
    .query(genreCollectionQuery, {}, { requestPolicy: 'network-only' })
    .toPromise();

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
