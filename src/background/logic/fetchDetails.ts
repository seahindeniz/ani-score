import type { TypedDocumentNode } from '@urql/core'
import type { FieldNode } from 'graphql'
import type { EpisodeCard } from '~/contentScripts/site/base'
import type { BatchAnimeTemplateQuery, Exact } from '~/gql/graphql'
import { Kind } from 'graphql'
import { useCacheStore, useTokenStore } from '~/logic'
import { logger } from '~/utils/logger'
import { wait } from '~/utils/wait'
import { anilistClient } from '../client/anilist'
import { batchTemplate, singleAnimeQuery } from '../gql-queries/anilist'
import { searchAnimeByTitle } from './loadDatabase'

interface Props {
  cards: Pick<EpisodeCard, 'title' | 'episodeNumber'>[]
}

const maxAnimePerQuery = 5
const maxAliasCharacters = 70

const _inheritType = anilistClient.query(singleAnimeQuery, {})

export type AnimeDetails = NonNullable<NonNullable<NonNullable<NonNullable<Awaited<typeof _inheritType>['data']>['one_piece']>['results']>[0]>

function createAlias(title: string, index: number): string {
  const cleanTitle = title
    .slice(0, maxAliasCharacters)
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase()

  return `a_${index + 1}_${cleanTitle}`
}

function escapeGraphQLString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function generateBatchQuery(animeList: ReturnType<typeof findAnimeListInDatabase>) {
  let currentChunk: FieldNode[] = []
  let chunkIndex = 0

  return animeList.reduce((acc, { title, anilist, mal }, index) => {
    const alias = createAlias(title, index)
    const source = anilist ? 'withId' : mal ? `withIdMal` : `withSearch`
    const [batchQueryKeyDefinition] = batchTemplate.definitions

    if (batchQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
      const template = batchQueryKeyDefinition.selectionSet.selections.find((selection) => {
        return selection.kind === Kind.FIELD && selection.alias?.value === source
      }) as FieldNode | undefined

      const query = structuredClone(template)

      if (query?.selectionSet) {
        Object.assign(query.alias!, { value: alias })

        const [resultsField] = query.selectionSet.selections

        if (resultsField.kind === Kind.FIELD) {
          if (resultsField.arguments && resultsField.arguments[1].value.kind === Kind.INT) {
            Object.assign(resultsField.arguments[1].value, {
              value: source === 'withId' ? anilist! : source === 'withIdMal' ? mal! : escapeGraphQLString(title),
            })
          }

          if (resultsField.selectionSet) {
            const [singleQueryKeyDefinition] = singleAnimeQuery.definitions

            if (singleQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
              const [singleAnimeAliasKeyField] = singleQueryKeyDefinition.selectionSet.selections

              if (singleAnimeAliasKeyField.kind === Kind.FIELD && singleAnimeAliasKeyField.selectionSet) {
                const [singleResultsField] = singleAnimeAliasKeyField.selectionSet.selections

                if (singleResultsField.kind === Kind.FIELD)
                  Object.assign(resultsField.selectionSet, { selections: singleResultsField.selectionSet?.selections })
              }
            }
          }
        }

        currentChunk.push(query)

        if (currentChunk.length === maxAnimePerQuery || index === animeList.length - 1) {
          const compiledQuery = structuredClone(batchTemplate)
          const [batchQueryKeyDefinition] = compiledQuery.definitions

          if (batchQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
            if (batchQueryKeyDefinition.name) {
              Object.assign(batchQueryKeyDefinition.name!, { value: `BatchAnimeSearch${chunkIndex}` })
            }

            batchQueryKeyDefinition.selectionSet.selections = currentChunk
          }

          acc.push(compiledQuery)

          currentChunk = []
          chunkIndex++
        }
      }
    }

    return acc
  }, [] as (TypedDocumentNode<BatchAnimeTemplateQuery, Exact<{
    [key: string]: never
  }>>)[])
}

function removeAllBeforeSlash(url: string): string {
  return url.replace(/.*\//, '')
}

function findSourceInDatabase(title: string) {
  const anime = searchAnimeByTitle(title)

  if (!anime) {
    return undefined
  }

  return anime.sources?.sort(
    (a, b) => (Number.parseInt(removeAllBeforeSlash(a)) - Number.parseInt(removeAllBeforeSlash(b))),
  ).reduce((map, item) => {
    if (item.includes('anilist.co')) {
      map.anilist = removeAllBeforeSlash(item)
    }

    if (item.includes('myanimelist.net')) {
      map.mal = removeAllBeforeSlash(item)
    }

    return map
  }, {} as { anilist?: string, mal?: string })
}

function findAnimeListInDatabase(titles: string[]) {
  return titles.map((title) => {
    const sources = findSourceInDatabase(title)

    return ({ title, ...sources })
  })
}

type FetchResult = Record<string, {
  pageInfo: { hasNextPage: boolean }
  results: AnimeDetails[]
} | null>

export async function fetchDetails(props: Props) {
  const uniqueTitles = [...new Set(props.cards.map(card => card.title))]

  if (uniqueTitles.length === 0) {
    return undefined
  }

  logger.log('Fetching details for titles:', uniqueTitles)

  try {
    const cacheStore = useCacheStore()
    const dbResult = findAnimeListInDatabase(uniqueTitles)
    const queries = generateBatchQuery(dbResult)
    const queryPromises = []

    for (const query of queries) {
      queryPromises.push(
        anilistClient.query<FetchResult>(query, {}, {
          requestPolicy: cacheStore.data().fetchDetails ? 'cache-first' : 'network-only',
        }).toPromise(),
      )

      await wait(150)
    }

    const results = await Promise.allSettled(queryPromises)

    if (!cacheStore.data().fetchDetails) {
      cacheStore.setData({ fetchDetails: true })
    }

    for (const result of results) {
      if (result.status === 'rejected' && result.reason.error) {
        logger.error('GraphQL query error:', result.reason.error)

        if (result.reason?.error?.message?.includes('Invalid token')) {
          const tokenStore = useTokenStore()

          tokenStore.setData({ ...tokenStore.data(), anilist: '' })

          browser.notifications.create('open-side-panel', {
            type: 'basic',
            iconUrl: browser.runtime.getURL('assets/icon-512.png'),
            title: 'AniScore',
            message: 'Anilist token is invalid. Please click on the AniScore extension icon and re-authenticate.',
            priority: 2,
          })
        }

        return undefined
      }
    }

    const mergedData = results.reduce(
      (map, result) => {
        if (result.status === 'fulfilled' && result.value.data) {
          Object.assign(map, result.value.data)
        }

        return map
      },
      {} as Record<string, {
        pageInfo: { hasNextPage: boolean }
        results: AnimeDetails[]
      } | null>,
    )

    return uniqueTitles.reduce((map, title, index) => {
      const alias = createAlias(title, index)
      const animeData = mergedData[alias]

      map[title] = animeData?.results[0] || null

      return map
    }, {} as Record<string, AnimeDetails | null>)
  }
  catch (error) {
    logger.error('Error fetching anime details:', error)

    return undefined
  }
}
