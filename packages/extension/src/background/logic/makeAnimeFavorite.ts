import { anilistClient } from '../client/anilist'
import { makeMediaFavoriteQuery } from '../gql-queries/anilist'

export function makeAnimeFavorite(animeId: number) {
  const promise = anilistClient.mutation(makeMediaFavoriteQuery, { animeId }).toPromise()

  return promise
}
