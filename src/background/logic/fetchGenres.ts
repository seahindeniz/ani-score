import { graphql } from '~/gql'
import { anilistClient } from '../client/anilist'

const query = graphql(/* GraphQL */ `
  query GenreCollection {
    GenreCollection
  }
`)

export function fetchGenres() {
  return anilistClient.query(query, {}).toPromise()
}
