import { expect, spyOn, test } from 'bun:test';

import { anilistClient } from '../../client/anilist';
import { genreCollectionQuery } from '../../gql-queries/anilist';
import { fetchGenres } from '../fetchGenres';

test('asks AniList for its genre collection', async () => {
  const result = { data: { GenreCollection: ['Action', 'Drama'] } };
  // The shared client caches query results, so stub it rather than the network
  const query = spyOn(anilistClient, 'query').mockReturnValue({
    toPromise: () => Promise.resolve(result),
  } as any);

  expect(await fetchGenres()).toBe(result as any);
  expect(query).toHaveBeenCalledWith(genreCollectionQuery, {});

  query.mockRestore();
});
