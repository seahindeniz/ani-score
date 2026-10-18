import { anilistClient } from '../client/anilist';
import { makeMediaFavoriteQuery } from '../gql-queries/anilist';
import { forgetDetails } from './detailsCache';

export async function makeAnimeFavorite(animeId: number) {
  const result = await anilistClient
    .mutation(makeMediaFavoriteQuery, { animeId })
    .toPromise();

  // Its favourites changed, so the cards showing it ask AniList again
  if (!result.error) {
    forgetDetails((_, details) => details?.id === animeId);
  }

  return result;
}
