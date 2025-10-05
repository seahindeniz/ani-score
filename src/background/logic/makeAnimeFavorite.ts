import { graphql } from '~/gql'
import { cacheStore } from '~/logic'
import { anilistClient } from '../client/anilist'

const query = graphql(/* GraphQL */ `
  mutation MakeAnimeFavorite($animeId: Int!) {
    ToggleFavourite(animeId: $animeId) {
      anime {
        pageInfo {
          total
        }
      }
    }
  }
`)

export function makeAnimeFavorite(animeId: number) {
  const promise = anilistClient.mutation(query, { animeId }).toPromise()

  cacheStore.setData({ fetchDetails: false })

  return promise
}
