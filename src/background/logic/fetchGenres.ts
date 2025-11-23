import { anilistClient } from '../client/anilist'
import { genreCollectionQuery } from '../gql-queries/anilist'

export function fetchGenres() {
  return anilistClient.query(genreCollectionQuery, {}).toPromise()
}
